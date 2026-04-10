

# Activity & Audit Log System for Super Admin Dashboard

## What This Adds

A new **"Activity Logs"** tab in the Super Admin Dashboard showing:
- **Login history** — who logged in, when, from what device/browser
- **Navigation tracking** — which pages/features each admin visited
- **Action log** — what operations they performed (existing `admin_audit_log` data)
- **Error tracking** — client-side errors encountered by admins during their session

## Database Changes

### New table: `admin_activity_log`
Captures granular client-side activity from admin/staff users.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | |
| user_id | uuid NOT NULL | The admin/staff user |
| event_type | text NOT NULL | `login`, `navigation`, `action`, `error` |
| event_detail | text | Page path, button clicked, or error message |
| metadata | jsonb | Browser info, device, IP hint, error stack, etc. |
| created_at | timestamptz | When the event occurred |

RLS: Super admins SELECT all; service_role ALL; regulators SELECT (so main admins can also view). Insert allowed for authenticated users (own rows only).

### Existing table: `admin_audit_log`
Already captures server-side admin actions — will be queried alongside the new table for a unified view.

## Frontend Changes

### 1. Activity tracking hook — `src/hooks/useActivityTracker.ts`
- Listens to route changes via `useLocation()` and logs `navigation` events
- Logs a `login` event on auth session start (checking if session is fresh)
- Wraps `window.onerror` / `window.onunhandledrejection` to log `error` events for admin users
- Batches inserts (every 10 seconds or on page unload) to avoid excessive DB writes
- Only activates for users with the `regulator` role

### 2. Integrate tracker — `src/components/RegulatorLayout.tsx`
- Add `useActivityTracker()` call so it runs for all admin users inside the layout

### 3. New tab in Super Admin Dashboard — "Activity Logs"
Added to `SuperAdminDashboard.tsx` with:
- **Filterable table** showing combined activity from `admin_activity_log` + `admin_audit_log`
- Filters: user, event type (login/navigation/action/error), date range
- Columns: Time, User (name + email), Event Type (badge), Detail, Device/Browser
- Color-coded badges: login (green), navigation (blue), action (yellow), error (red)
- Click to expand row for full metadata/context JSON
- Defaults to last 24 hours, up to 500 rows

## Technical Details

- Activity inserts use the anon/authenticated client (user's own JWT) — RLS ensures users can only insert their own rows
- The batching mechanism uses a ref-based queue flushed on interval or `beforeunload`
- Navigation events deduplicate (won't log the same path twice within 2 seconds)
- Error events capture: message, stack trace (truncated), component name if available
- Login detection: on `SIGNED_IN` auth event, check if last login was >5 min ago before logging

## Impact
- Gives Super Admin full visibility into platform usage patterns and errors
- No performance impact on regular users (tracker only runs in regulator layout)
- Existing `admin_audit_log` data (server-side actions) is surfaced alongside client activity

