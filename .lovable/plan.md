

# Create Three Test Accounts for System Demo

Since the database is clean, I'll create a backend function to seed three test accounts with registration fees pre-paid so you can log in immediately.

## Accounts to Create

| Role | Phone (Login) | Password | Synthetic Email |
|------|--------------|----------|-----------------|
| Regulator | admin@rentcontrol.gov.gh | Admin123! | (email login) |
| Tenant | 024 000 1234 | 001234 | 0240001234@rentcontrolghana.local |
| Landlord | 024 000 5678 | 005678 | 0240005678@rentcontrolghana.local |

## What Gets Created Per Account

- **Auth user** (auto-confirmed)
- **Profile** (full_name, phone, email via `handle_new_user` trigger)
- **User role** (tenant/landlord/regulator via trigger)
- **Tenant/Landlord record** with `registration_fee_paid = true` (so no paywall)

## Implementation

### New file: `supabase/functions/seed-test-users/index.ts`
- Creates 3 users via admin API (`auth.admin.createUser`)
- The `handle_new_user` trigger auto-creates profiles and user_roles
- Then inserts tenant/landlord records with `registration_fee_paid = true`
- Idempotent: skips if email already exists

### Invoke
- Call the function once after deployment to seed the accounts
- No UI changes needed

## Files

| File | Action |
|------|--------|
| `supabase/functions/seed-test-users/index.ts` | **Create** — one-time seed function |

