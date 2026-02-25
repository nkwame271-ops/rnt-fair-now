

## Analysis

I found the root causes of both issues.

### Issue 1: Role Misrouting (everyone lands on wrong dashboard)

Every single RLS policy in the database is set to **RESTRICTIVE** (`Permissive: No`). In PostgreSQL, restrictive policies require **ALL** policies to pass simultaneously. For the `user_roles` table:

- "Users can read own roles" (RESTRICTIVE) -- `auth.uid() = user_id`
- "Regulators can read all roles" (RESTRICTIVE) -- `has_role(auth.uid(), 'regulator')`

For a tenant: the first passes, but the second fails because they're not a regulator. Since both are restrictive and **both must pass**, the query returns nothing. The role comes back as `null`, and `ProtectedRoute` redirects to `/`.

This same bug affects **every table** in the system -- properties, tenancies, complaints, etc. All have multiple restrictive policies that block legitimate access.

### Issue 2: Payment gating happens too early

Currently, `RegisterTenant.tsx` and `RegisterLandlord.tsx` create the account AND immediately initiate Hubtel payment on step 2. The user wants: sign up first, go to the dashboard, and see an "unpaid" banner there with a "Pay Now" button.

---

## Plan

### Step 1: Fix all RLS policies (database migration)

Drop every restrictive policy and recreate them as **PERMISSIVE** (the PostgreSQL default). This affects tables: `user_roles`, `profiles`, `properties`, `property_images`, `units`, `tenancies`, `rent_payments`, `complaints`, `landlords`, `tenants`, `viewing_requests`, `agreement_template_config`.

### Step 2: Modify registration to skip payment

**`RegisterTenant.tsx`** and **`RegisterLandlord.tsx`**:
- Remove step 2 (payment). Change the flow to: Personal Info → Delivery Address → Success (3 steps instead of 4).
- On the delivery address step, create the account (signup + profile + tenant/landlord record with `registration_fee_paid: false`) and go straight to the success screen.
- Success screen says "Go to Dashboard" without requiring payment.

### Step 3: Add registration fee banner to dashboards

**`TenantDashboard.tsx`**:
- On load, fetch the tenant record and check `registration_fee_paid`.
- If unpaid, show a prominent alert banner at the top: "Your registration fee (GH₵ 50) is unpaid. Pay now to activate your Tenant ID."
- "Pay Now" button triggers the Hubtel checkout edge function for `tenant_registration`.

**`LandlordDashboard.tsx`**:
- Same pattern: fetch landlord record, check `registration_fee_paid`, show banner with "Pay Now" if unpaid.

### Files to change

| File | Change |
|------|--------|
| New migration SQL | Drop all restrictive policies, recreate as permissive |
| `src/pages/RegisterTenant.tsx` | Remove payment step; create account on step 1 completion; go to dashboard |
| `src/pages/RegisterLandlord.tsx` | Same as above |
| `src/pages/tenant/TenantDashboard.tsx` | Add unpaid registration fee banner with Pay Now |
| `src/pages/landlord/LandlordDashboard.tsx` | Add unpaid registration fee banner with Pay Now |

