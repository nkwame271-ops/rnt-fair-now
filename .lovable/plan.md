

# Fix Build Error & Edge Function Issues

## Root Cause

The **`@swc/core` native binding error** is preventing the entire application from building and deploying. This is the root cause of all reported issues -- the app cannot start, so the user sees stale/broken behavior. Edge functions may also not be deploying properly.

The error comes from `@vitejs/plugin-react-swc` which requires a native binary (`@swc/core`) that is incompatible with the current build environment.

## Login Status

The Login page **already has both Phone and Email sign-in modes** (implemented in the previous change). Once the build error is fixed, this will work correctly.

## Plan

### 1. Fix build: Switch from SWC to Babel plugin
**File**: `package.json`, `vite.config.ts`

- Replace `@vitejs/plugin-react-swc` with `@vitejs/plugin-react` (Babel-based, no native binaries)
- Update the import in `vite.config.ts` from `@vitejs/plugin-react-swc` to `@vitejs/plugin-react`

This eliminates the native binding dependency entirely.

### 2. Redeploy edge functions
Once the build succeeds, the edge functions (including `paystack-checkout`) will redeploy with the latest code that handles `listing_fee` and `rent_card_bulk` payment types correctly.

## Files to Change

| File | Change |
|------|--------|
| `package.json` | Replace `@vitejs/plugin-react-swc` with `@vitejs/plugin-react` |
| `vite.config.ts` | Update import to use `@vitejs/plugin-react` |

