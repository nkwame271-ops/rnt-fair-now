

# Fix: Main Admin Feature Filtering

## Problem

In `RegulatorLayout.tsx` line 71, the nav filter has:

```typescript
if (!profile || profile.isMainAdmin) return true;
```

This means **all main admins see every feature**, regardless of what was selected during invitation. The database confirms some main admins have specific `allowed_features` (e.g., only `["rent_cards"]`) but the UI ignores this.

## Solution

**File**: `src/components/RegulatorLayout.tsx`

Update the filter logic so main admins with a populated `allowedFeatures` array are also filtered. Only bypass filtering when there's no profile or when `allowedFeatures` is empty (legacy/unrestricted admins).

```typescript
// BEFORE:
if (!profile || profile.isMainAdmin) return true;

// AFTER:
if (!profile) return true;
if (profile.allowedFeatures.length === 0) return true; // unrestricted admin
```

This single change makes feature filtering apply to **both** main admins and sub admins equally when features were explicitly selected during invitation. Legacy admins with an empty `allowedFeatures` array continue to see everything.

No backend or database changes needed.

