

# Security Hardening: Rent Card Serial Assignment

## Summary

Enforce the stated security rules at the database level and tighten frontend code. The current implementation is mostly correct but lacks database-level enforcement — security relies only on frontend logic.

## Database Changes (Migration)

### 1. Prevent direct serial_number writes by non-regulators
Create a trigger on `rent_cards` that blocks any `UPDATE` setting `serial_number` unless the current user has the regulator role (or is service_role). This prevents landlords from manually writing serial numbers even if they craft raw API calls.

```sql
CREATE OR REPLACE FUNCTION public.enforce_serial_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Allow service_role (backend) and regulators only
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    IF NOT has_role(auth.uid(), 'regulator') THEN
      RAISE EXCEPTION 'Only regulators can assign serial numbers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_serial_assignment
  BEFORE UPDATE ON public.rent_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_serial_assignment();
```

### 2. Prevent serial_number on INSERT (landlords create cards via payment with null serial)
Add a trigger on `INSERT` that rejects any row where `serial_number IS NOT NULL` unless caller is regulator or service_role.

### 3. Add office_id to serial_assignments audit table
Currently only stores `office_name`. Add `office_id text` for structured querying.

### 4. Drop the generate_rent_card_serial() function
It is no longer used (default was already removed). Dropping it prevents accidental use.

## Frontend Changes

### 1. `PendingPurchases.tsx` — Add office_id to audit log
When inserting into `serial_assignments`, include `office_id` from the admin profile alongside `office_name`.

### 2. `AssignmentHistory.tsx` — Display office_id
Show the office ID in the history entries for traceability.

### 3. `AddTenant.tsx` — No changes needed
Landlords select rent cards from a dropdown of their `valid` cards (serial assigned by regulator). They never type a serial. This is already correct.

### 4. `ManageRentCards.tsx` — No changes needed
Serial numbers are display-only. The "Awaiting Serial" state shows a message to visit the office. Already correct.

## Technical Details

| Security Rule | Current State | Fix |
|---|---|---|
| No system-generated serials | `generate_rent_card_serial()` exists but default removed | Drop the function entirely |
| Only batch-uploaded serials valid | Enforced by workflow (stock table) | Add DB trigger blocking non-regulator serial writes |
| Office assigns own stock only | Frontend filter by office_name | Already correct — queries filter by office_name |
| Landlords cannot type serials | Dropdown selection only | Already correct in AddTenant.tsx |
| Auto-assign to purchase record | Officer clicks Assign button | Already correct in PendingPurchases.tsx |
| Full audit logging | serial_assignments table exists | Add office_id column for completeness |

## Files to Modify

| File | Action |
|---|---|
| Migration SQL | Add triggers, drop function, add office_id column |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Include office_id in audit insert |
| `src/pages/regulator/rent-cards/AssignmentHistory.tsx` | Display office_id |

