

# Plan: Rent Card Range Logic + Admin Safe Controls + Audit Trail

## Overview
This is a significant update touching serial assignment flow, landlord inventory concept, tenancy card selection (2 cards per tenancy), admin destructive action controls, and audit logging. No changes to the core rent card purchase or payment framework.

## Part 1: Database Changes (Migration)

### New table: `admin_audit_log`
Tracks all admin destructive/corrective actions.
```sql
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL, -- 'revoke_batch', 'unassign_serial', 'void_upload', 'deactivate_account', 'archive_account', 'correction'
  target_type text NOT NULL, -- 'serial_stock', 'rent_card', 'landlord', 'tenant'
  target_id text NOT NULL,
  reason text NOT NULL,
  old_state jsonb DEFAULT '{}',
  new_state jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```
RLS: Regulators SELECT only, service_role ALL.

### Alter `rent_card_serial_stock`
- Add column `revoked_at timestamptz`
- Add column `revoked_by uuid`
- Add column `revoke_reason text`
- Update status enum to support `'revoked'`

### Alter `rent_cards` — support 2 cards per tenancy
Currently `tenancies.rent_card_id` is a single UUID. The spec says each tenancy needs **2 cards** (landlord copy + tenant copy).
- Add `card_role text` column to `rent_cards` (values: `'landlord_copy'`, `'tenant_copy'`, null for legacy)
- Add `tenancies.rent_card_id_2 uuid` for the second card reference

### Alter `landlords` and `tenants`
- Add `account_status text DEFAULT 'active'` to both tables (values: `'active'`, `'deactivated'`, `'archived'`)

## Part 2: Regulator UI — Admin Controls (Main Admin Only)

### Update `RegulatorRentCards.tsx`
Add a new tab: **"Admin Actions"** (Main Admin only)
Contains 4 sections:
1. **Revoke Serial Batch** — search by batch label or office, select unused serials, revoke with reason + password confirmation
2. **Unassign Serial** — search by serial number, unassign if not linked to tenancy, with reason + password
3. **Void Upload** — find a batch by label, void all unused serials in that batch
4. **Audit Log** — read-only view of all `admin_audit_log` entries

### Create `src/pages/regulator/rent-cards/AdminActions.tsx`
New component with the above 4 sections. Each destructive action:
- Checks `profile.isMainAdmin` before rendering
- Shows a confirmation dialog requiring the admin's password (re-authenticate via Supabase `signInWithPassword`)
- Requires a text reason field
- Calls the backend, logs to `admin_audit_log`

### Create `src/components/AdminPasswordConfirm.tsx`
Reusable dialog component: takes `onConfirm(password, reason)`, validates password via Supabase auth, then executes the action.

## Part 3: Assignment Flow Update — Range-based

### Update `PendingPurchases.tsx`
Currently assigns serials 1:1 to individual `rent_cards` rows. Update to:
- Show how many **pairs** are needed (pending_count / 2 or pending_count depending on whether cards are already pairs)
- Assign consecutive serials from office stock as a range block
- Display the assigned range (e.g., "RC-001 to RC-010") instead of individual badges

### Update `OfficeSerialStock.tsx`
- Add a "Ranges" view showing contiguous serial blocks per office
- Show which ranges are fully available vs partially assigned

## Part 4: Tenancy Registration — 2 Cards Per Tenancy

### Update `AddTenant.tsx`
Currently selects 1 rent card. Change to:
- Auto-select 2 unused (`valid` status) rent cards from landlord's inventory
- Label them as "Landlord Copy" and "Tenant Copy"
- Both get activated and linked to the same tenancy
- Update the `rent_cards` rows with `card_role` field

### Update tenancy insert logic
- Set both `rent_card_id` and `rent_card_id_2` on the tenancy
- Activate both cards with the same tenancy details but different `card_role`

## Part 5: Landlord Dashboard — Serial Inventory View

### Update `ManageRentCards.tsx`
- Add an "Assigned Serials" section showing the landlord's serial range inventory
- Group cards by assignment batch showing range notation (e.g., "RC-20260319-0001 to RC-20260319-0010")
- Show which serials are unused vs active vs used

## Part 6: Edge Function for Admin Actions

### Create `supabase/functions/admin-action/index.ts`
Handles destructive actions server-side with service_role:
- Accepts `{ action, target_id, reason, password }` 
- Re-authenticates admin via password
- Validates the action is safe (e.g., serial not in active tenancy)
- Executes the action (revoke, unassign, void, deactivate, archive)
- Logs to `admin_audit_log`
- Returns success/failure

## Summary of Files

| File | Action |
|---|---|
| Migration SQL | New `admin_audit_log` table, alter `rent_card_serial_stock`, `rent_cards`, `tenancies`, `landlords`, `tenants` |
| `supabase/functions/admin-action/index.ts` | **Create** — server-side admin action handler |
| `supabase/config.toml` | Add `admin-action` function |
| `src/components/AdminPasswordConfirm.tsx` | **Create** — reusable password+reason confirmation dialog |
| `src/pages/regulator/rent-cards/AdminActions.tsx` | **Create** — Main Admin destructive controls UI |
| `src/pages/regulator/RegulatorRentCards.tsx` | Add "Admin Actions" tab (Main Admin only) |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Update to assign range blocks, show range notation |
| `src/pages/regulator/rent-cards/OfficeSerialStock.tsx` | Add range view for serial blocks |
| `src/pages/landlord/ManageRentCards.tsx` | Add serial inventory view, group by range |
| `src/pages/landlord/AddTenant.tsx` | Select 2 cards per tenancy (landlord copy + tenant copy) |

