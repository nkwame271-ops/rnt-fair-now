## Root cause

Toggling Management Support calls the `set_property_management` RPC, which updates `public.properties`. That fires the `trg_propagate_mgmt_flag` trigger, whose function `propagate_property_management_flag()` runs:

```sql
UPDATE public.pending_tenants
  SET managed_by_platform = NEW.management_enabled, ...
  WHERE property_id = NEW.id;
```

But `pending_tenants` has no `property_id` column (verified against the live schema — it only has `tenancy_id`, plus the `managed_by_platform` / `assigned_staff_id` columns added in the same migration). Postgres aborts the trigger with `column "property_id" does not exist`, which bubbles up as the error the landlord sees when flipping the toggle.

The `viewing_requests` branch of the same trigger is fine — that table does have `property_id`.

## Fix

Replace `propagate_property_management_flag()` so the `pending_tenants` propagation joins through `tenancies` → `units` → `properties` instead of a non-existent direct `property_id`. The `viewing_requests` branch stays unchanged.

New body (conceptually):

```sql
UPDATE public.viewing_requests
   SET managed_by_platform = NEW.management_enabled,
       assigned_staff_id   = CASE WHEN NEW.management_enabled
                                  THEN NEW.management_assigned_staff_id END
 WHERE property_id = NEW.id
   AND status IN ('pending','awaiting_payment');

UPDATE public.pending_tenants pt
   SET managed_by_platform = NEW.management_enabled,
       assigned_staff_id   = CASE WHEN NEW.management_enabled
                                  THEN NEW.management_assigned_staff_id END
 WHERE pt.tenancy_id IN (
   SELECT t.id
     FROM public.tenancies t
     JOIN public.units u ON u.id = t.unit_id
    WHERE u.property_id = NEW.id
 );
```

Wrap both updates in the existing `IF management_enabled OR assigned_staff_id changed` guard so behaviour is unchanged otherwise.

## Implementation steps

1. **Migration** — `CREATE OR REPLACE FUNCTION public.propagate_property_management_flag()` with the corrected body above (SECURITY DEFINER, `SET search_path = public`, same trigger binding). No table schema changes, no new GRANTs needed.
2. **Verify** — after the migration runs:
   - Call `set_property_management` for a real landlord property with `p_enabled = true` and confirm it returns `{success: true}` with no error.
   - Confirm `properties.management_enabled` flipped and `property_management_log` got a row.
   - Confirm matching `viewing_requests` and `pending_tenants` rows received the propagated `managed_by_platform` / `assigned_staff_id`.
3. **No frontend changes** — `PropertyManagementToggle.tsx` and `LandlordManagementSupport.tsx` already call the RPC correctly; the failure was purely the trigger.

## Technical notes

- `units.property_id` is the documented link from tenancy to property in this schema; the join above mirrors what other RPCs in the project already use.
- The fix is idempotent and safe to re-run.
- No data backfill is required: `managed_by_platform` defaults to `false`, and the next toggle for each property will propagate correctly through the corrected trigger.
