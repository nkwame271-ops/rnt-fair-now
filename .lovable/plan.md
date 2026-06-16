# Super Admin → Google Drive Backup

A new Super Admin–only module that connects the platform to a Google Drive account and lets the admin run **one-click full backups** of every business-critical table. Backups land as a single timestamped folder in Drive containing one CSV per table plus a JSON manifest.

## What the Super Admin gets

A new page under Super Admin → **System → Backups** with:

1. **Connection card** — "Connect Google Drive" button. Once connected, shows the connected Google account email, the target backup folder name, and a Disconnect option.
2. **One-Click Backup button** — runs a full export of all selected tables and uploads to Drive. Progress bar shows table-by-table status.
3. **Backup history table** — every run logged: who triggered it, when, table counts, total rows, Drive folder link, status (success/partial/failed).
4. **Scheduled backups (optional toggle)** — daily / weekly auto-backup at a chosen time (off by default; can ship later).
5. **Restore guidance panel** — read-only notes explaining how to restore from a backup folder (manual support process, not automated, to avoid catastrophic overwrites).

## What gets backed up

Every backup folder will contain CSVs for:

- **Identity**: `profiles`, `user_roles`, `admin_staff`, `landlords`, `tenants`, `pending_tenants`, `kyc_verifications`
- **Property & tenancy**: `properties`, `units`, `property_images`, `tenancies`, `tenancy_signatures`, `rent_payments`, `rent_increase_requests`, `rent_assessments`
- **Rent cards**: `rent_cards`, `rent_card_serial_stock`, `serial_assignments`, `rent_card_sales_channels`, `rent_card_channel_splits`
- **Complaints & cases**: `complaints`, `cases`, `complaint_decisions`, `complaint_hearings`, `complaint_documents`, `complaint_status_history`
- **Finance**: `escrow_transactions`, `escrow_splits`, `payment_receipts`, `payment_intents`, `payout_transfers`, `api_invoices`
- **Regulator**: `offices`, `office_allocations`, `region_codes`, `admin_audit_log`
- **Developer API**: `developer_organizations`, `developer_org_members`, `api_keys`, `api_access_requests`

Plus `manifest.json` with: timestamp, triggered_by, app version, table list, row counts per table, schema hash.

## How the connection works

Use the existing **Google Drive App Connector** (workspace-scoped, OAuth via Lovable's connector gateway). Because Super Admin is a single shared "company" identity (not per-end-user), this is the correct model — the connector authenticates the company's Google account once and stores OAuth tokens for the platform.

Connection guard: connector linking and the backup page itself are blocked unless `is_main_admin()` returns true. No other role sees this module.

## Technical details

### Backend

**Edge function `backup-to-drive`** (Super Admin–gated, `verify_jwt = true`, role-check inside):
1. Validates caller is `is_main_admin()` via JWT.
2. Streams each whitelisted table with the service role client, paginated 1000 rows at a time.
3. Converts each table to CSV in-memory (chunked) — never loads full DB into RAM.
4. Creates a Drive folder `RentControlGhana-Backup-YYYY-MM-DD-HHMM/` via Drive gateway `POST /upload/drive/v3/files?uploadType=multipart`.
5. Uploads each CSV with `parents: [folderId]`.
6. Uploads `manifest.json` last (acts as completion marker).
7. Writes a row to `system_backup_log`.

Gateway base: `https://connector-gateway.lovable.dev/google_drive/drive/v3` with `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${GOOGLE_DRIVE_API_KEY}`.

**New table `system_backup_log`** (RLS: Super Admin only):
- `triggered_by` (uuid), `started_at`, `finished_at`, `status` (`running` / `success` / `partial` / `failed`)
- `drive_folder_id`, `drive_folder_url`, `drive_folder_name`
- `tables_included` (jsonb), `row_counts` (jsonb), `total_rows`, `error_message`

**Optional scheduled backups**: pg_cron job invoking the edge function with a service-role bearer; gated behind a `platform_config.auto_backup_enabled` flag (off by default).

### Frontend

- New route `/super-admin/backups` registered in `App.tsx`.
- New page `src/pages/super-admin/Backups.tsx`.
- Sidebar entry in Super Admin layout under "System".
- Uses `supabase.functions.invoke('backup-to-drive')`; shows toast + streams progress via polling `system_backup_log` row every 2s.

### What's intentionally out of scope (v1)

- **Automated restore** — too risky to expose as a button; document the manual restore path instead.
- **Per-table on-demand export** — keep v1 focused on full one-click backup; can add later.
- **Storage tables / file blobs** (KYC docs, voice notes) — v1 backs up DB rows only. File blob backup can be a phase 2 (Drive has size implications).

## Open questions before build

1. Should v1 include the **scheduled daily/weekly auto-backup** toggle, or ship manual one-click only first?
2. Should backups include **file storage blobs** (KYC documents, complaint documents, voice notes) — or DB rows only in v1?
3. Backup retention: keep all backup folders forever in Drive, or auto-delete folders older than e.g. 30/90 days?
