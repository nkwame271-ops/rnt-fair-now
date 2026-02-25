

## Comprehensive System Fix Plan

### Issues Found

**1. Hubtel Edge Function — `getClaims` does not exist (CRITICAL)**
The `hubtel-checkout` edge function uses `supabase.auth.getClaims(token)` on line 26, but this method does not exist in the supabase-js SDK. This is why every payment attempt returns `"Unexpected end of JSON input"` — the function crashes before reaching the Hubtel API. The fix is to replace it with `supabase.auth.getUser()`, which validates the JWT and returns the user ID.

**2. Registration "User already registered" error**
When a user who already exists tries to register again (e.g. `nkwame271@gmail.com`), the code correctly catches this. However, the user experience needs improvement — the registration pages should first check if the user is already logged in and skip straight to payment if they already have an account but haven't paid.

**3. Login redirects — regulator login doesn't use auth hook**
The Login page manually queries `user_roles` after sign-in and navigates, but the `useAuth` hook's `onAuthStateChange` also fires and tries to fetch the role. This creates a race. The `ProtectedRoute` component should handle the redirect after the auth state settles — the login page should just sign in and let the router take over.

**4. Data gaps — need more tenancy connections**
Currently there's only 1 tenancy (linking tenant `3b6ed5f0` to landlord `1fc95bfe`). To demonstrate the regulator view properly, we need more tenancies connecting landlords to tenants, plus some landlords with no tenants and tenants with no landlords.

---

### Implementation Plan

#### Step 1: Fix `hubtel-checkout` edge function
Replace the broken `getClaims` call with `getUser()`:
```typescript
// BEFORE (broken):
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");
const userId = claimsData.claims.sub as string;

// AFTER (working):
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
if (authError || !authUser) throw new Error("Not authenticated");
const userId = authUser.id;
```
Then redeploy the function.

#### Step 2: Fix Login page navigation
Update `Login.tsx` to navigate based on the fetched role and also handle the regulator role (currently only handles tenant/landlord). Add regulator redirect:
```typescript
if (userRole === "tenant") navigate("/tenant/dashboard");
else if (userRole === "landlord") navigate("/landlord/dashboard");
else if (userRole === "regulator") navigate("/regulator/dashboard");
else navigate("/");
```

#### Step 3: Seed additional test data
Insert additional tenancies and rent payments to create a realistic system state:

- **2 more tenancies** linking existing tenants to landlords:
  - Tenant `tenant@test.com` (Kwame Mensah) → Landlord `landlord@test.com` (Ama Asante), Sunrise Apartments unit
  - Tenant `kofi.owusu@test.com` → Landlord `akua.osei@test.com`, Golden Gate Estate unit

- **Rent payment records** for each tenancy so the payment flow is visible

This gives the regulator dashboard:
- 3 landlords (1 with no tenants: Kwesi Addo)
- 7 tenants (some with tenancies, some without)
- 4 complaints across different statuses
- Multiple tenancies showing landlord-tenant connections

#### Step 4: Improve registration flow for existing users
In both `RegisterTenant.tsx` and `RegisterLandlord.tsx`, when the signup returns "user already exists", also try signing in with the provided credentials. If login succeeds and the user has no tenant/landlord record yet, create it and proceed to payment. If they already have a record, redirect to dashboard.

#### Step 5: Verify all edge functions
- `hubtel-checkout`: Fix and redeploy (Step 1)
- `hubtel-webhook`: Already correct — uses service role key, properly handles all payment types
- `legal-assistant`: Working correctly — uses Lovable AI gateway
- `invite-staff`: Verify it exists and works

### Technical Details

**Database state** — all RLS policies are now PERMISSIVE (fixed in previous migration). The `user_roles` table correctly has roles for all 11 users (7 tenants, 3 landlords, 1 regulator). The `handle_new_user` trigger auto-creates profiles and assigns roles from signup metadata.

**Hubtel integration** — The `PAYMENT_API_ID` and `PAYMENT_API_KEY` secrets are configured. The API endpoint `https://payproxyapi.hubtel.com/items/initiate` is correct per Hubtel docs. The webhook at `hubtel-webhook` correctly uses the service role key to update records. The only blocker was the `getClaims` crash preventing the checkout from ever reaching Hubtel.

**Auth flow** — The `useAuth` hook now uses role caching and deferred fetching. Login should be fast once the `getClaims` fix removes the edge function error cascade.

