

# Stress Test Report — Go-Live Readiness

## Critical Issues Found

### 1. VerifyTenancy page is broken for unauthenticated users (CRITICAL)
The `/verify-tenancy/:tenancyId` page is public (no auth), but it queries `tenancies`, `profiles`, and `rent_cards` — all of which have RLS policies requiring `auth.uid()`. An unauthenticated QR code scan will return empty results.

**Fix**: Create a backend function `verify-tenancy` that uses the service role to fetch tenancy data, so the public verification page works without login.

### 2. Registration creates user but can silently fail on profile/tenant insert (MEDIUM)
In `RegisterTenant.tsx` and `RegisterLandlord.tsx`, if `signUp` succeeds but the `profiles.update` or `tenants.insert` fails, the user is stuck — they exist in auth but have no tenant/landlord record. No error is shown for partial failures.

**Fix**: Wrap profile update + tenant/landlord insert in a try-catch that rolls back (signs out + deletes) on failure, or at minimum shows a clear error.

### 3. Rent payments inserted one-by-one in AddTenant (PERFORMANCE)
`AddTenant.tsx` line 207 inserts rent payments in a `for` loop — one DB call per month. For a 12-month lease, that's 12 sequential requests.

**Fix**: Batch insert all payments in a single `.insert([...])` call.

### 4. Registration code generated client-side with Math.random (COLLISION RISK)
`AddTenant.tsx` line 123: `RC-GR-2026-XXXXX` uses `Math.random()`. With real users, collisions are possible and the `registration_code` column is not unique-constrained.

**Fix**: Generate registration codes server-side using a sequence, or add a unique constraint and retry on conflict.

### 5. Console warnings: Function components cannot be given refs
Login and RoleSelect pages produce React warnings about refs. This is a minor issue from `react-router-dom` passing refs to function components.

**Fix**: Wrap `Login` and `RoleSelect` with `React.forwardRef` or use a wrapper div.

### 6. Viewing request status tracking is incomplete
After paying the viewing fee, the `viewingRequestsByUnit` state is only loaded on mount. If the user pays and returns, the callback toast fires but the viewing request map isn't refreshed — the "Request Viewing" button may still appear.

**Fix**: Re-fetch viewing requests after the `viewing_paid` callback.

### 7. Missing `property_images` table in VerifyTenancy query context
Not a bug, but the marketplace and property detail views rely on `property_images` — if landlords don't upload images, fallback images are used. This is fine.

### 8. No email confirmation enforcement
Auth uses `signUp` with synthetic emails (`phone@rentcontrolghana.local`). These aren't real emails, so email confirmation must be disabled. Need to verify auto-confirm is enabled.

**Fix**: Confirm auto-confirm is enabled for email signups in auth settings.

---

## Implementation Plan

### Task 1: Fix VerifyTenancy for public access
- Create edge function `verify-tenancy` that accepts `tenancyId`, uses service role to query tenancy + profiles + rent_cards
- Update `VerifyTenancy.tsx` to call the edge function instead of direct Supabase queries
- Register in `supabase/config.toml` with `verify_jwt = false`

### Task 2: Batch rent payment inserts
- In `AddTenant.tsx`, collect all payment objects in an array and call `.insert(payments)` once

### Task 3: Fix registration code collision risk
- Add unique constraint on `tenancies.registration_code` via migration
- Generate code with a DB sequence or retry logic on conflict

### Task 4: Re-fetch viewing requests after payment callback
- In `Marketplace.tsx`, after the `viewing_paid` toast, re-fetch the user's viewing requests

### Task 5: Fix React ref warnings
- Wrap `Login` and `RoleSelect` with `forwardRef` or add a wrapper element

### Task 6: Ensure auth auto-confirm is enabled
- Use `configure_auth` tool to verify/enable auto-confirm for the synthetic email flow

### Task 7: Handle partial registration failures gracefully
- In `RegisterTenant.tsx` and `RegisterLandlord.tsx`, catch profile/tenant insert errors and show actionable messages

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/verify-tenancy/index.ts` | **New** — public edge function for tenancy verification |
| `supabase/config.toml` | Add `verify-tenancy` function config |
| `src/pages/shared/VerifyTenancy.tsx` | Use edge function instead of direct queries |
| `src/pages/landlord/AddTenant.tsx` | Batch payment inserts; add unique code retry |
| `src/pages/tenant/Marketplace.tsx` | Re-fetch viewing requests after payment callback |
| `src/pages/Login.tsx` | Wrap with forwardRef |
| `src/pages/RoleSelect.tsx` | Wrap with forwardRef |
| `src/pages/RegisterTenant.tsx` | Better error handling for partial failures |
| `src/pages/RegisterLandlord.tsx` | Better error handling for partial failures |
| DB migration | Add unique constraint on `tenancies.registration_code` |
| Auth config | Ensure auto-confirm enabled |

