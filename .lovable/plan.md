

# Fix: Payments, Revenue, Properties, Complaints

## Issues and Solutions

### 1. Archive Search Fee Not Adjustable in Engine Room
The `archive_search_fee` feature flag was inserted into the database but the Engine Room UI already renders all feature flags dynamically from the `feature_flags` table. Need to verify the row exists with correct `category: 'fees'`. If the insert from the previous migration didn't run, re-insert it.

**Files**: Database insert (verify/fix `archive_search_fee` flag row)

---

### 2. Rent Tax Bulk Payment Doubles the Amount
**Root cause**: The `paystack-checkout` edge function's `rent_tax_bulk` handler fetches ALL unpaid `rent_payments` for the tenancy (line 258-263), but the frontend only shows and calculates the **advance months** portion (first N months). If lease = 12 months and advance = 6, backend charges all 12 unpaid months while frontend shows 6.

**Fix**: In `paystack-checkout/index.ts`, limit the `rent_tax_bulk` query to only fetch the first `advance_months` unpaid payments (using the tenancy's `advance_months` field and limiting results).

```
// Limit to advance_months count
.limit((tenancy as any).advance_months)
```

**Files**: `supabase/functions/paystack-checkout/index.ts`

---

### 3. Payment Processing After Deduction
The `verify-payment` edge function or webhook likely isn't marking payments as confirmed quickly enough. The user sees "processing" because the callback shows `status=success` but the webhook hasn't completed yet. This is expected Paystack behavior — add clearer messaging that payment was received and will reflect shortly, and trigger a re-fetch after a delay.

**Files**: `src/pages/tenant/Payments.tsx` — improve the success callback UX with auto-refresh

---

### 4. Only One Agreement's Payments Shown
**Root cause**: `Payments.tsx` line 49: `.limit(1)` — only fetches the first tenancy. Users with multiple tenancies only see payments for one.

**Fix**: Remove `.limit(1)`, fetch all active/pending tenancies, and render a payment section per tenancy with a selector or list.

**Files**: `src/pages/tenant/Payments.tsx`

---

### 5. Escrow Revenue by Type Not Updating
**Root cause**: The `revenueByType` aggregation filters on `completed` transactions only (line 79). The `rent_card` payment type string must exactly match what's stored in `escrow_transactions.payment_type`. The edge function stores `type` directly — for rent cards it could be `rent_card` or `rent_card_bulk`. Need to include `rent_card_bulk` in the types array.

**Fix**: Add `rent_card_bulk` to `REVENUE_TYPE_CONFIG`'s Rent Card Sales types. Also add `termination_fee` variants, `tenant_registration_fee`/`landlord_registration_fee` to registrations types.

**Files**: `src/pages/regulator/EscrowDashboard.tsx`

---

### 6. Platform Revenue Visibility — CFLECD-Only Access
Currently hidden for non-main admins. The user wants a dedicated, separate view accessible only to CFLECD (the platform operator). 

**Suggestion**: Create a separate "Platform Revenue" page accessible only via a direct URL or a hidden menu item that checks for a specific `admin_type` value or a new flag. For now, keeping the current `isMainAdmin` gate is sufficient — CFLECD staff are the only `main_admin` users. No change needed unless they want a completely separate dashboard.

**No changes needed** — current implementation already restricts to `main_admin` only.

---

### 7. Duplicate Property — Show Old Price, Permanent Tag
When a property is flagged as a duplicate (`pending_identity_review`), the admin should see the **old property's rent** alongside the duplicate badge. The tag should persist permanently (never be auto-cleared).

**Fix**: 
- In `check-property-duplicate` edge function, return the existing property's unit rents in the response
- Store duplicate match info on the new property (add `duplicate_of_property_id` and `duplicate_old_rent` columns)
- In `RegulatorProperties.tsx`, show the old rent next to the duplicate badge and prevent the "Clear" button from removing it — instead change status but keep the duplicate tag visible

**Files**: 
- `supabase/functions/check-property-duplicate/index.ts` — return existing property rent
- `src/pages/landlord/RegisterProperty.tsx` — store duplicate info on new property
- `src/pages/regulator/RegulatorProperties.tsx` — show permanent duplicate tag with old rent
- Database migration: add `duplicate_of_property_id uuid`, `duplicate_old_rent numeric` to `properties`

---

### 8. Complaint Appointment Slots Not Selectable
**Root cause**: `AppointmentSlotPicker` only fetches schedules for complaints with status `schedule_complainant` (line 41). But the `MyCases.tsx` page also fetches schedules independently (line 56-67) and shows "Awaiting your slot selection (check above)" pointing to the `AppointmentSlotPicker` component. If the component returns `null` (no matching schedules found), the user sees the message but no picker.

The issue: `AppointmentSlotPicker` filters complaints by `status = 'schedule_complainant'` AND then fetches schedules with `status IN ('pending_selection', 'confirmed')`. If the complaint status was changed by the admin but the schedule was already created, or if the schedule's complaint_id doesn't match, the picker shows nothing.

**Fix**: Instead of filtering by complaint status, `AppointmentSlotPicker` should directly query `complaint_schedules` where `status = 'pending_selection'` for the user's complaints (regardless of complaint status). This decouples the picker from the complaint status.

**Files**: `src/components/AppointmentSlotPicker.tsx`

---

## Database Changes

```sql
ALTER TABLE public.properties 
  ADD COLUMN IF NOT EXISTS duplicate_of_property_id uuid,
  ADD COLUMN IF NOT EXISTS duplicate_old_rent numeric;
```

## Summary of File Changes

| File | Change |
|---|---|
| `supabase/functions/paystack-checkout/index.ts` | Limit rent_tax_bulk to advance_months count |
| `src/pages/tenant/Payments.tsx` | Show all tenancies' payments, improve success UX |
| `src/pages/regulator/EscrowDashboard.tsx` | Fix revenue type mapping (add `rent_card_bulk` etc.) |
| `src/components/AppointmentSlotPicker.tsx` | Query all user complaints, not just `schedule_complainant` |
| `supabase/functions/check-property-duplicate/index.ts` | Return existing property rent info |
| `src/pages/landlord/RegisterProperty.tsx` | Store duplicate match info on new property |
| `src/pages/regulator/RegulatorProperties.tsx` | Permanent duplicate tag with old rent display |
| Database migration | Add `duplicate_of_property_id`, `duplicate_old_rent` to properties |
| Database insert | Verify `archive_search_fee` feature flag exists |

