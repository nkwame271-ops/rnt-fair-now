## Status check: not fully resolved

The DELETE trigger `trg_unlink_rent_cards_on_tenancy_delete` is in place and working for *future* deletions. However, **15 rent cards are still showing as "Linked" in the landlord portal** because the previous cleanup pass only cleared `tenancy_id` — it left `tenant_user_id`, `property_id`, `unit_id`, `status='active'`, `activated_at`, etc. populated.

The landlord UI marks a card as "Linked" using:
```
isLinked = card.status === "active" && card.tenant_user_id
```
So as long as those fields remain set, the cards still display as Linked even though the tenancy is gone.

## What I will fix

1. **Repair the 15 orphaned rent cards** so they fully unlink — clear `tenant_user_id`, `property_id`, `unit_id`, `start_date`, `expiry_date`, `current_rent`, `previous_rent`, `advance_paid`, `last_payment_status`, `activated_at`, `qr_token`, and reset `status` to `valid` (if a serial is present) or `awaiting_serial` (if not), exactly mirroring the existing trigger.

2. **Harden the cleanup so it cannot recur**: change the trigger to also fire when a tenancy's `tenant_user_id` is cleared via UPDATE, not only on DELETE. This covers the admin "soft removal" path used by Super Admin where the tenancy row may be archived rather than hard-deleted.

3. **Audit the admin-action delete path** (`supabase/functions/admin-action/index.ts`) to confirm it issues an actual `DELETE` on `tenancies` (which fires the trigger) rather than only nulling fields. If it currently does a soft removal, route it through the same unlink logic explicitly before/after the operation.

## Why this keeps showing up

The earlier repair migration only touched `tenancy_id`, but the landlord UI's "Linked" badge depends on `status` + `tenant_user_id`. The trigger does the full cleanup, but only on DELETE — soft-removal or partial-cleanup paths leave the card looking active.

## Files affected

- One new database migration (data repair for existing 15 cards + trigger update)
- `supabase/functions/admin-action/index.ts` (verify deletion path uses real DELETE or invoke the unlink helper)

## Validation

- Re-run the orphan query: `SELECT count(*) FROM rent_cards WHERE tenancy_id IS NULL AND tenant_user_id IS NOT NULL` should return 0.
- Have Super Admin remove a test tenancy and confirm the linked rent card flips to Unlinked / Available in the landlord portal immediately.
