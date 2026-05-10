## Goal
Make the **Existing Tenancy** row in the Admin → Agreements list reflect reality:
- Three context-aware action buttons that distinguish the **declared record** from the **agreement document**.
- The captured tenant name (not the landlord's) and a clear *Awaiting Tenant Registration / Acceptance* status.
- Automatic linkage to the tenant's account the moment they register.

## What already works (no change needed)
- Schema: `tenancies.placeholder_tenant_name`, `placeholder_tenant_phone`, `pending_tenant_id` exist.
- `DeclareExistingTenancy` now stores `tenant_user_id = NULL` and writes the placeholder columns when no match is found.
- `RegulatorAgreements` reads `placeholder_tenant_name` when there's no tenant account.
- Tenant-side accept flow in `MyAgreements` already produces `final_agreement_pdf_url`.

## What still breaks
1. Old `existing_migration` rows created before the placeholder columns were added still have `tenant_user_id = landlord_user_id`, so the admin list keeps showing the landlord's name.
2. There is no UI badge that explicitly says *Awaiting Tenant Registration / Acceptance*.
3. When the tenant finally signs up with the same phone, nothing links them to the tenancy automatically.
4. Action-button labels need to be regularised: **Details** must always be visible for the declared record; **Draft / Final / Uploaded** must appear *only* when their corresponding document exists.

## Plan

### 1. Database migration — backfill + auto-link trigger
- **Backfill**: for every `tenancies` row where `tenancy_type = 'existing_migration'` AND `landlord_accepted = true` AND `tenant_accepted = false` AND `tenant_user_id = landlord_user_id`:
  - Set `tenant_user_id = NULL`.
  - Copy the matching `pending_tenants.full_name` / `phone` into `placeholder_tenant_name` / `placeholder_tenant_phone` (or fall back to the `tenant_id_code` lookup).
- **Trigger `link_existing_tenancy_on_signup`** on `profiles` AFTER INSERT:
  - Normalise `NEW.phone` to `233XXXXXXXXX`.
  - Find tenancies where `tenant_user_id IS NULL` and `placeholder_tenant_phone` (normalised) matches.
  - Update those rows: `tenant_user_id = NEW.user_id`, clear `placeholder_tenant_name/phone`, leave `tenant_accepted = false` and `status = 'existing_declared'` so the tenant must still accept.
  - Mark related `pending_tenants` rows as `linked_user_id = NEW.user_id, linked_at = now()`.
  - Insert a notification: *"A landlord declared an existing tenancy for you. Review and accept in My Agreements."*

### 2. Admin Agreements UI (`RegulatorAgreements.tsx`)
- Add a new pill next to the status badge when `_tenantPending` is true:
  *"Awaiting Tenant Registration / Acceptance"* (warning style).
- Re-order/relabel action buttons inside `renderActionButtons` for `tenancy_type === 'existing_migration'`:
  - **Details** — always visible, opens the declared-record PDF (current `downloadPdf` with `useExistingFormat`).
  - **Draft** — only if `agreement_pdf_url` exists AND `final_agreement_pdf_url` is empty (purchased, landlord-signed, awaiting tenant).
  - **Final** — only if `final_agreement_pdf_url` exists (both parties signed).
  - **Uploaded** — only if `existing_agreement_url` exists (manual upload path).
- Non-existing tenancies keep today's **PDF** button.

### 3. Landlord Agreements list (`Agreements.tsx`)
- Apply the same three-button rule and the *Awaiting Tenant Registration / Acceptance* badge so the landlord sees the same truth.

### 4. Verify acceptance closes the loop
- No code change expected: when the linked tenant opens *My Agreements*, the existing accept flow already flips `tenant_accepted = true`, stamps `tenant_signed_at`, generates `final_agreement_pdf_url`, and moves status to `active`. After that the admin row will automatically drop the *Awaiting…* pill and show the **Final** button.

## Acceptance checks
1. An `existing_migration` declared today **without** a matched tenant: admin row shows the captured tenant name, *Awaiting Tenant Registration / Acceptance* pill, and only **Details** (+ **Draft** if purchased, or **Uploaded** if a file was attached).
2. The same tenant registers with the declared phone → admin row instantly shows the real tenant name; pill changes to *Awaiting Acceptance* only.
3. Tenant accepts in My Agreements → admin row gains **Final** button; pill disappears; status flips to *active*.
4. Legacy existing-migration rows (where `tenant_user_id` had been set to the landlord) no longer display the landlord's name after the backfill.
