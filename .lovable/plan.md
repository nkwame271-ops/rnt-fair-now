

## Problem Analysis

The Email OTP flow has two distinct bugs:

1. **Supabase sends a magic link, not a 6-digit OTP code.** By default, `signInWithOtp({ email })` sends a magic link email. The Login page UI shows a 6-digit code input, but the user never receives a code — they receive a clickable link instead.

2. **Magic link redirects to `/` (RoleSelect), which doesn't handle authenticated users.** When the user clicks the magic link, Supabase completes auth and redirects to the site root. But `RoleSelect` has no logic to detect an authenticated session and redirect to the correct dashboard. So the user just sees the login screen again.

## Fix

### File 1: `src/pages/Login.tsx`
- Add `emailRedirectTo` option in the `signInWithOtp` call, pointing to `/login?role=<role>` so the magic link brings users back to the Login page (not `/`)
- Add a `useEffect` on mount that checks if the user is already authenticated (i.e., they just arrived via magic link redirect). If so, call `navigateByRole()` to send them to the correct dashboard
- Update the UI copy: change "6-digit verification code" language to "magic link" to match what the user actually receives. Remove the OTP code input UI and replace with a "Check your email for a magic link" confirmation screen

### File 2: `src/pages/RoleSelect.tsx`
- Add a safety net: if a user arrives at `/` while already authenticated, redirect them to their dashboard based on their role. This handles edge cases where magic links or other auth flows redirect to the root URL.

### No database, API, or permission changes needed.

### Summary of changes
| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Fix OTP flow to work as magic link; add redirect-on-auth logic; update UI copy |
| `src/pages/RoleSelect.tsx` | Add authenticated user redirect |

