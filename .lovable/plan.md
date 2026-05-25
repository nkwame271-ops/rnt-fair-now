## 1. Fix Region dropdown — add missing regions

The Region list lives hardcoded in `src/hooks/useAdminProfile.ts` (`GHANA_REGIONS_OFFICES`). It currently has **15** regions and is missing **North East** and **Savannah**, and the "Ashanti and Ahafo" appearance is because there is no separate Ashanti/Ahafo merge — the offices are correctly separated, but a couple of region labels are off. Fix:

- Add the two missing region entries (with empty offices arrays initially; admins can attach offices later):
  - `North East` → e.g. Nalerigu (placeholder)
  - `Savannah` → e.g. Damongo (placeholder)
- Keep `GHANA_REGIONS` derived from the same source (so every region picker updates automatically).
- Audit every `<Select>` that lists regions (InviteStaff, OfficeAllocation, SalesChannelsManager, RegionCodeManager, SerialBatchUpload, OfficeSerialStock) and confirm they all import `GHANA_REGIONS` — no inline arrays.

No DB migration needed (region is stored as plain text on `rent_card_serial_stock.region`, `admin_staff.office_id`, etc.).

## 2. Stock Allocation — show all unallocated stock, not just reconciliation adjustments

In `src/pages/regulator/rent-cards/OfficeAllocation.tsx` the available-pool counters (lines ~157–177) and the range-mode list (lines ~140–155) already filter on `status='available' AND stock_type='regional'` — which is correct in principle. The visible bug is that the allocation list/range picker is excluding rows where `stock_source='generation'` somewhere else (a downstream filter or a UI tab labelled "Reconciliation"). Fix:

- Remove any `.eq("stock_source", "adjustment")` / `"reconciliation_correction"` filter from the allocation queries — load **all** rows where `status='available' AND stock_type='regional' AND pair_index=1`, regardless of `stock_source`.
- Re-label the four status buckets in the UI using the clean taxonomy the user proposed (frontend-only mapping over existing DB values):
  - `Uploaded` → all rows in `rent_card_serial_stock`
  - `Unallocated` → `status='available' AND stock_type='regional'`
  - `Allocated` → `status='available' AND stock_type='office'`
  - `Sold` → `status='assigned'`
  - `Reconciliation adjustment` → `stock_source='adjustment'` (informational tag, not a hard filter on the allocation pool)
  - `Cancelled/Void` → `status='revoked'`
- Add a small legend tile showing the five counts so operators see the full picture.

## 3. Invite Staff — link to Sales Channels + permission level

### Database (one migration)
- Add to `admin_staff`:
  - `sales_channel_id uuid REFERENCES rent_card_sales_channels(id) ON DELETE SET NULL`
  - `channel_permissions jsonb NOT NULL DEFAULT '{}'::jsonb` (holds the six toggles)
  - `phone text` (currently the form has no phone field; the user explicitly wants Phone number)
- Index `admin_staff(sales_channel_id)`.
- Update RLS unchanged (still gated by `is_main_admin`).

### Edge function `supabase/functions/invite-staff/index.ts`
- Accept new payload fields: `phone`, `salesChannelId`, `channelPermissions`.
- Persist them on the `admin_staff` insert (only when `adminType !== 'nugs_admin'`).
- Pass `phone` into the auth `user_metadata` so `handle_new_user` populates `profiles.phone`.

### UI `src/pages/regulator/InviteStaff.tsx`
- Add a Phone Number field (already in the user's required list).
- Add an "Assign sales channel" `<Select>` (loads from `rent_card_sales_channels` where `is_active=true`). Shown for Main Admin and Sub Admin (not NUGS).
- Add a "Channel permissions" checkbox group with six toggles, defaults shown in brackets:
  - View assigned stock [on]
  - Sell rent cards [on]
  - Assign rent cards to landlords [off]
  - View sales report [on]
  - Edit reconciliation [off, locked]
  - Create new stock [off, locked]
- Pass the new fields through `supabase.functions.invoke("invite-staff", …)`.
- The two locked permissions render as disabled checkboxes with a small tooltip explaining the policy.

### Sales Channels Manager
- In `SalesChannelsManager.tsx` add a "Staff" column on the channel table showing a count of `admin_staff` linked to that channel (cheap secondary query). No edit UI here — assignment happens in Invite Staff.

## Out of scope
- Existing duplicate-code handling in `SalesChannelsManager` (already fixed earlier).
- The seeded `rent_card_channel_splits` rows — untouched.
- No changes to `nugs_staff`.

## Technical details

- Files to edit:
  - `src/hooks/useAdminProfile.ts` — add North East + Savannah.
  - `src/pages/regulator/rent-cards/OfficeAllocation.tsx` — drop the `stock_source` narrowing; add status legend.
  - `src/pages/regulator/InviteStaff.tsx` — phone, sales-channel select, permission checkboxes.
  - `src/pages/regulator/rent-cards/SalesChannelsManager.tsx` — add Staff count column.
  - `supabase/functions/invite-staff/index.ts` — handle new fields.
- One migration:
  - `ALTER TABLE admin_staff ADD COLUMN phone text, ADD COLUMN sales_channel_id uuid REFERENCES rent_card_sales_channels(id) ON DELETE SET NULL, ADD COLUMN channel_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;`
  - `CREATE INDEX idx_admin_staff_sales_channel ON admin_staff(sales_channel_id);`
