

# Fix: Daily Report "invalid input syntax for type uuid" Error

## Root Cause

In `DailyReport.tsx` line 115, `staff_user_id` is set to an empty string `""`. The `daily_stock_reports.staff_user_id` column is typed as `uuid`, and Postgres rejects empty strings as invalid UUIDs.

## Solution

Replace the empty string with the authenticated user's actual `auth.uid()`. The component already has access to `profile`, but doesn't extract the user ID. We need to get the current user's ID from Supabase auth and pass it as `staff_user_id`.

### File: `src/pages/regulator/rent-cards/DailyReport.tsx`

- On mount or before submit, call `supabase.auth.getUser()` to get the current user's UUID
- Replace `staff_user_id: ""` (line 115) with `staff_user_id: user.id`
- Minimal change — just fetch the auth user and use their ID

