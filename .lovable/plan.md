

# Enforce Account Uniqueness: Phone, Email, and Ghana Card

## Current State

Registration uses a synthetic email (`{phone}@rentcontrolghana.local`) as the Supabase auth identifier. Phone uniqueness is **partially enforced** — if signup returns "already registered", the user is prompted to log in. However:

- **No pre-registration check** — the duplicate is only caught after the `signUp` call, and the current flow sometimes silently signs in and creates a second role record.
- **Email uniqueness** — optional real email stored in `profiles.email` is not checked for duplicates.
- **Ghana Card uniqueness** — `profiles.ghana_card_no` has no uniqueness constraint. The requirement allows the same Ghana Card for one tenant + one landlord account, but not two tenants or two landlords.

## Plan

### 1. Add database uniqueness constraints (Migration)

```sql
-- Unique index on profiles.phone (one phone = one account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
  ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';

-- Unique index on profiles.email (one email = one account)  
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
  ON public.profiles (email) WHERE email IS NOT NULL AND email != '';

-- Ghana Card: allow same card for one tenant + one landlord, 
-- but not two of the same role.
-- Composite unique index on (ghana_card_no, role via user_roles)
-- Implemented as a unique index on profiles joined with role:
CREATE UNIQUE INDEX IF NOT EXISTS idx_ghana_card_per_role
  ON public.profiles (ghana_card_no, 
    (CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND role = 'tenant') THEN 'tenant'
          WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND role = 'landlord') THEN 'landlord'
          ELSE 'unknown' END))
  WHERE ghana_card_no IS NOT NULL AND ghana_card_no != '';
```

The composite index approach won't work with subqueries. Instead, add a `registered_role` column to profiles (populated by the `handle_new_user` trigger), then create:

```sql
-- Add registered_role to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registered_role text;

-- Unique: one ghana card per role
CREATE UNIQUE INDEX IF NOT EXISTS idx_ghana_card_per_role
  ON public.profiles (ghana_card_no, registered_role)
  WHERE ghana_card_no IS NOT NULL AND ghana_card_no != '';
```

Update `handle_new_user()` trigger to set `registered_role` from metadata.

### 2. Pre-registration validation checks (Frontend)

**Files: `RegisterTenant.tsx` and `RegisterLandlord.tsx`**

Before calling `signUp`, add validation queries:

- **Phone check**: Query `profiles` for matching phone. If found, check the role. If same role exists → block with "This phone is already registered as a Tenant/Landlord. Please log in or recover your account." If different role → allow (same person registering for opposite role — but this creates a new auth user with same phone, which conflicts with synthetic email uniqueness). 

Actually, since phone maps to synthetic email which maps to auth user, one phone = one auth user is already enforced by Supabase auth. The issue is the current code silently signs in on duplicate and creates a second role. We need to **stop that behavior** and instead show a clear block message.

### Revised approach

#### A. Fix duplicate phone handling in both registration pages

Currently when `signUp` returns "already registered", the code tries to sign in with the temp password and create a tenant/landlord record under that existing user. This is wrong — it bypasses the "one phone = one account" rule.

**Change**: When `signUp` fails with "already registered":
- Do NOT attempt silent sign-in
- Show error: "This phone number is already registered. Please log in or recover your account."
- Provide action buttons: "Go to Login" and "Reset Password"

#### B. Pre-check email uniqueness

Before `signUp`, query `profiles` table for matching email (if user provided one). If found → block with "This email is already in use by another account."

#### C. Pre-check Ghana Card uniqueness per role

Before `signUp`, query `profiles` table for matching `ghana_card_no`. Join with `user_roles` to check the role:
- If same Ghana Card exists with same role → block: "This Ghana Card is already registered as a [Tenant/Landlord]. Please log in or recover your account."
- If same Ghana Card exists with different role → allow (one card, two roles is permitted)

#### D. Database constraint as safety net

Add a unique index on `profiles.ghana_card_no` + role from `user_roles`. Since indexes can't reference other tables, use a simpler approach:

```sql
-- Add unique index on phone (already enforced by auth synthetic email, but belt-and-suspenders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
  ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';
```

For Ghana Card per role, add a trigger-based validation instead of an index, since the role lives in `user_roles`:

```sql
CREATE OR REPLACE FUNCTION check_ghana_card_uniqueness()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ghana_card_no IS NOT NULL AND NEW.ghana_card_no != '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.ghana_card_no = NEW.ghana_card_no
        AND p.user_id != NEW.user_id
        AND ur.role = (SELECT role FROM user_roles WHERE user_id = NEW.user_id LIMIT 1)
    ) THEN
      RAISE EXCEPTION 'Ghana Card already registered for this role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_ghana_card
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_ghana_card_uniqueness();
```

## Files to modify

- **`src/pages/RegisterTenant.tsx`** — Remove silent sign-in on duplicate; add pre-checks for email and Ghana Card
- **`src/pages/RegisterLandlord.tsx`** — Same changes
- **Migration** — Add phone unique index + Ghana Card per-role validation trigger

## Summary of user-facing behavior

| Scenario | Result |
|---|---|
| Same phone, any role | "Phone already registered. Log in or recover account." |
| Same email, any role | "Email already in use." |
| Same Ghana Card, same role | "Ghana Card already registered as [role]. Log in or recover." |
| Same Ghana Card, different role | Allowed (one tenant + one landlord) |

