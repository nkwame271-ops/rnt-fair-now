

# Improve Module Visibility — Show Admin Picker for "Selected Admins" and Super Admin Emails

## Problem
When you set a section's visibility to "Selected Admins", there is no way to choose which admins get access — the dropdown just saves the value with no admin picker. Similarly, when "Super Admin Only" is selected, there is no indication of who the super admins are. On mobile (430px), the fixed-width select trigger may also overflow.

## Changes

### `src/pages/regulator/SuperAdminDashboard.tsx`

1. **"Selected Admins" — show admin multi-select picker**
   After the visibility Select, when the value is `selected_admins`, render a collapsible section below with checkboxes listing every admin/staff by email and name. Checking/unchecking updates the `allowed_admin_ids` array on the `module_visibility_config` row. This uses the `staff` state already loaded.

2. **"Super Admin Only" — show super admin emails**
   When visibility is `super_admin_only`, show a small info line below listing the email(s) of all super admins on the platform (filtered from the `staff` array where `admin_type === "super_admin"`).

3. **Mobile layout fix**
   Change the visibility row from `flex items-center justify-between` to a stacked layout on small screens. Change `w-[180px]` to `w-full sm:w-[180px]` so the select fits on mobile. Stack the label and select vertically on small screens using `flex-col sm:flex-row`.

### Database
No schema changes needed — `module_visibility_config` already has the `allowed_admin_ids` column (uuid array).

## Result
When you pick "Selected Admins", a list of all admins appears with checkboxes so you can choose exactly who sees that section. When you pick "Super Admin Only", you see the super admin email(s). The layout works cleanly on mobile.

