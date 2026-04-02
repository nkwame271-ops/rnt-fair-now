

# Fix: Invite Staff Errors & Empty Rent Cards for Sub-Admins

## Problems Found

### Problem 1: Invite Staff returns 400
The edge function logs show repeated **400** status codes. The most likely cause is `auth.admin.createUser` rejecting the request because:
- The email was already registered from a previous attempt
- The edge function returns `{ error: createError.message }` with status 400, but the frontend's `supabase.functions.invoke` wraps any non-2xx as a generic "Edge function returned a non-2xx code" error, hiding the real message

**Fix**: Improve error surfacing so the actual Paystack/auth error message reaches the UI. Also add a duplicate-email pre-check.

### Problem 2: Rent Cards page is empty for sub-admins
The invite form offers `rent_cards` as a single checkbox (from `FEATURE_ROUTE_MAP`). But `RegulatorRentCards.tsx` checks for two **sub-feature keys** that don't exist in the feature map:
- `rent_card_procurement`
- `rent_card_sales`

A sub-admin with `allowedFeatures: ["rent_cards"]` passes the nav filter (sees the menu item) but fails both `hasProcurement` and `hasSales` checks, so both tab panels are hidden — resulting in an empty page.

## Plan

### 1. Fix Rent Cards feature gating (this is the main issue)

In `RegulatorRentCards.tsx`, update the permission checks to also accept the parent `rent_cards` key:

```typescript
const hasProcurement = isMain 
  || profile?.allowedFeatures?.includes("rent_card_procurement")
  || profile?.allowedFeatures?.includes("rent_cards");
const hasSales = isMain 
  || profile?.allowedFeatures?.includes("rent_card_sales")
  || profile?.allowedFeatures?.includes("rent_cards");
```

This way, selecting `rent_cards` in the invite form grants both workspaces. Optionally, add `rent_card_procurement` and `rent_card_sales` as separate entries in `FEATURE_ROUTE_MAP` for granular control in the future.

### 2. Fix invite-staff error handling

In `InviteStaff.tsx`, the `supabase.functions.invoke` call doesn't properly extract the error body. The current code does:
```typescript
const { data, error } = await supabase.functions.invoke("invite-staff", { body: {...} });
if (error) throw new Error(error.message);
if (data?.error) throw new Error(data.error);
```

The issue: when the edge function returns a 400 with `{ error: "User already registered" }`, the Supabase client may throw with a generic message. Update to check `data?.error` first since the function returns JSON even on 400.

### 3. Add duplicate email pre-check in edge function

Before calling `createUser`, check if the email is already registered to give a clearer error message.

## Files to change

| File | Change |
|------|--------|
| `src/pages/regulator/RegulatorRentCards.tsx` | Accept `rent_cards` parent key in procurement/sales permission checks |
| `src/pages/regulator/InviteStaff.tsx` | Improve error extraction from edge function response |
| `supabase/functions/invite-staff/index.ts` | Minor: add clearer error for duplicate emails |

