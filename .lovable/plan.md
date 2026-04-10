

# Comprehensive Super Admin Staff Management Panel

## What Changes

Enhance the **Staff & Admins** tab in the Super Admin Dashboard to be a full staff control center, giving the Super Admin complete oversight and management of all admin/staff accounts.

### New Capabilities in the Staff Tab

1. **Deactivate / Freeze staff accounts** — calls existing `admin-action` with `deactivate_account` (account_type: "admin" pattern, but we need to add a `freeze_staff` action or use the existing `delete_account` flow)
2. **Delete staff accounts** — calls `admin-action` with `delete_account` + `account_type: "admin"` (already supported)
3. **Reset passwords** — calls `admin-action` or a new lightweight edge function to reset a staff member's password via `adminClient.auth.admin.updateUserById`
4. **Edit staff features/office** — update `allowed_features`, `office_id`, `office_name` on `admin_staff` table (Super Admin has RLS update access via `is_main_admin`)
5. **Inline staff creation** — embed the invite staff form directly in the Super Admin Dashboard (reuse `invite-staff` edge function)
6. **View last login info** — query `admin_activity_log` for each staff member's most recent login event
7. **Password confirmation dialog** — sensitive actions (delete, freeze) require admin password re-entry (reuse existing `AdminPasswordConfirm` component)

### Technical Changes

#### 1. New edge function action: `reset_staff_password` in `admin-action/index.ts`
Add a new case that accepts `target_id` (user_id) and `extra.new_password`, calls `adminClient.auth.admin.updateUserById(target_id, { password })`. Only main_admin/super_admin can invoke.

#### 2. Expand `SuperAdminDashboard.tsx` Staff tab
Replace the basic table with a comprehensive management UI:
- Each staff row gets action buttons: Edit Features, Reset Password, Freeze, Delete
- A "Create New Staff" button that opens an inline form (email, name, password, role, office, features)
- Show last login timestamp per staff member
- Color-coded status indicators
- Password confirmation modal for destructive actions

#### 3. Files modified
- `supabase/functions/admin-action/index.ts` — add `reset_staff_password` case
- `src/pages/regulator/SuperAdminDashboard.tsx` — rebuild Staff tab with full CRUD, last login display, action buttons, inline create form

### Security
- All destructive actions require password re-authentication (already enforced in `admin-action`)
- Only `main_admin` and `super_admin` can access these functions (already enforced)
- Super Admin cannot delete their own account (already enforced in backend)

