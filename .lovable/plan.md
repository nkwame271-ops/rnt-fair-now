# Fix Bundle: Reported Errors

This addresses each reported issue. Several items (rent unlock trigger, rent lock columns, tax pills, rent review enrichment) were partially shipped already; we will harden them where the user still sees a problem.

## 1. Beta Feedback & Contact Messages — no admin email

Both forms only write to the database. No notification ever reaches the admin inbox.

Fix: After insert, send a notification to the admin team using the existing `send-notification` edge function and (in parallel) write a row into `notifications` for any active super_admin so it also surfaces in the in‑app bell.

Files:
- `src/pages/RoleSelect.tsx` (ContactForm.handleSubmit)
- `src/components/BetaFeedbackWidget.tsx` (handleSubmit)

For each, after a successful insert, call:
```
supabase.functions.invoke("send-notification", { body: { event: "contact_received" / "beta_feedback_received", email: ADMIN_EMAIL, data: {...}} })
```

Add two new templates (`contact_received`, `beta_feedback_received`) in `supabase/functions/send-notification/index.ts` (`EMAIL_TEMPLATES`, `INAPP_TEMPLATES`, `CHANNEL_MAP`) targeting the configured admin notification email (read from a new `system_settings` row `admin_notify_email` with a sensible fallback constant).

## 2. NUGS Sub-Admin: Rent Card feature toggle does not show

`NugsLayout.adminNav` is hardcoded to 4 items with no rent card entry and no feature gating, so toggling the flag has no effect for sub-admins.

Fix:
- Add `{ to: "/nugs/rent-cards", label: "Rent Cards", icon: CreditCard, featureKey: "nugs_admin_rent_cards" }` to `adminNav`.
- Apply the same `featureKey` filter currently used for `studentNav` to admin nav (single shared filter loop).
- Add the route in `src/App.tsx` reusing `RegulatorRentCards` scoped to NUGS context (or a new lightweight page if scope differs).
- Migration: insert `nugs_admin_rent_cards` into `feature_flags` with `category='nugs'`, default `is_enabled=false`. Surface the toggle in `EngineRoom.tsx` under a new "NUGS Sub-Admin Features" section that filters `category='nugs'`.

## 3. Admin Portal Agreements — Tenant placeholder shows landlord name

Verified `Agreements.tsx` and `RegulatorAgreements.tsx` already use `placeholder_tenant_name` correctly when `tenant_user_id` is null, so the bug is in the row insert path.

Fix in `DeclareExistingTenancy.tsx`:
- Always populate `placeholder_tenant_name` and `placeholder_tenant_phone` from `draft.tenantName`/`tenantPhone`, even when `hasMatchedTenant` is true (only clear the placeholder once `tenant_accepted=true`).
- When the matched tenant accepts the agreement, a small backend step (db trigger or in `tenant_accepted` update flow) clears the placeholder fields. Add trigger `clear_placeholder_on_tenant_accept`.

Also patch the agreement‑PDF generator path: where it currently substitutes `{{TENANT_NAME}}` from `landlordName` fallback, force it to read the tenancy's effective tenant display name.

## 4. Existing Tenancy → Rent Card Unlinking

Trigger `trg_unlink_rent_cards_on_tenancy_delete` was created in the previous migration. Verify it is active and confirm `delete_existing_tenancy` admin action triggers a true row DELETE (not a soft delete). If the admin function performs a soft delete, switch it to hard `DELETE FROM tenancies` so the trigger fires, OR add a parallel `AFTER UPDATE` clause that fires when `deleted_at` is set.

Fix: read `supabase/functions/admin-action/index.ts` for `delete_tenancy`/`delete_existing_tenancy` and align with the trigger.

## 5. Rent Increase Lock

Already implemented in `EditProperty.tsx` (rent input `readOnly`) and `RegulatorRentReviews.tsx` (sets `rent_locked_*` and writes `monthly_rent`/`approved_rent`).

Hardening:
- Add a DB trigger `prevent_rent_unlock` on `units` and `properties` that raises if `monthly_rent`/`approved_rent` is changed while `rent_locked_at IS NOT NULL` and the new value differs from `rent_locked_amount`. Only `service_role` (used by approval flow) can bypass.
- Update `EditProperty.tsx` save path to never include `monthly_rent` in the update payload.

## 6. Rent Reviews — Property details visible & clickable to admin

`RegulatorRentReviews.tsx` already enriches and shows property + landlord. Add:
- Property name in the table row (new column "Property") linking to `/regulator/properties/:id` (or the existing detail route).
- In the dialog, wrap property name and landlord name in `<Link>` to their detail pages.

## 7. Tenant Tax Payment Status

Top-level "Pay All Advance Tax" already toggles to a "Paid / Tax Confirmed / Receipt Available" panel via `allAdvancePaid`. The remaining issue is per‑month behavior + a Pay button that may stay enabled briefly because the database row hasn't flipped yet.

Fix in `Payments.tsx`:
- After `handlePayBulkTax` returns from Paystack callback, poll `rent_payments` for the tenancy every 2s up to 10 attempts until `status='confirmed'` or `tenant_marked_paid=true` for all advance rows; refresh local state.
- Disable the Pay button while polling.
- Ensure `finalize-payment.ts` for `rent_tax`/`rent_tax_bulk` definitively sets `payments.status='confirmed'`, `tenant_marked_paid=true`, and `tenancies.tax_compliance_status='verified'` (verify already done in earlier change).

## Technical Notes

- Migrations needed:
  - Insert `nugs_admin_rent_cards` flag.
  - Trigger `clear_placeholder_on_tenant_accept` on `tenancies`.
  - Trigger `prevent_rent_unlock` on `units`/`properties`.
  - (Optional) augment `unlink_rent_cards_on_tenancy_delete` to also fire on soft-delete.
- Edge function changes:
  - Extend `send-notification` with `contact_received` and `beta_feedback_received` templates.
- Frontend files: `RoleSelect.tsx`, `BetaFeedbackWidget.tsx`, `NugsLayout.tsx`, `App.tsx`, `EngineRoom.tsx`, `DeclareExistingTenancy.tsx`, `EditProperty.tsx`, `RegulatorRentReviews.tsx`, `Payments.tsx`.
