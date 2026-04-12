

# Agreement Generation for "Buy Agreement" & Tax Compliance Status

## What Changes

### 1. Database: Add `tax_compliance_status` column to `tenancies`
Add a new column `tax_compliance_status TEXT NOT NULL DEFAULT 'pending'` to the `tenancies` table. Values: `pending` (tax not yet paid) and `verified` (tax paid). All existing tenancies with `tenancy_type = 'existing_migration'` will default to `pending`.

### 2. DeclareExistingTenancy: Generate & Upload Agreement PDF when "Buy" is selected
In `createTenancyRecord()` inside `DeclareExistingTenancy.tsx`, when `agreementChoice === "buy"`:
- After creating the tenancy record, generate the agreement PDF using `generateAgreementPdf()` with `isExistingTenancy: true` and the tenancy details
- Upload the PDF to `application-evidence` storage
- Save the URL to `tenancies.agreement_pdf_url`
- The tenancy status remains `existing_declared` with `tenant_accepted: false` — tenant must confirm
- Set `tax_compliance_status: 'pending'` on creation (default)

### 3. Tenant MyAgreements: Show existing tenancy agreements for confirmation
Update `MyAgreements.tsx` to:
- Include `existing_declared` tenancies in the pending section (currently only shows `status === "pending"`)
- For existing tenancies, tenant sees agreement details and can only **Confirm** or **Reject** — no tax payment required at this stage
- On confirm: update `tenant_accepted: true`, keep status as `existing_declared` (no tax gating)
- Show "Download Agreement" button if `agreement_pdf_url` or `final_agreement_pdf_url` exists
- Display tax compliance badge: "Tax Compliance: Pending" (amber) or "Tax Compliance: Verified" (green)

### 4. Signed PDF generation on tenant confirmation
When tenant confirms an existing tenancy agreement (bought version):
- Generate a final signed PDF with both landlord (auto-signed at creation) and tenant signatures
- Upload to storage and save as `final_agreement_pdf_url`
- This signed version becomes downloadable by tenant, landlord, and admin

### 5. Tax Compliance Badge — visible across dashboards
Add tax compliance status display to:
- **Landlord Agreements page** (`Agreements.tsx`): Show badge next to each existing tenancy — "Tax: Pending" or "Tax: Verified"
- **Admin RegulatorAgreements page** (`RegulatorAgreements.tsx`): Show tax compliance column/badge for existing tenancies
- **TenancyCard component** (`TenancyCard.tsx`): Include tax compliance indicator

### 6. Tax Compliance auto-update
When rent tax is paid for an existing tenancy (via the existing payment flow in `rent_payments`), update `tax_compliance_status` to `verified`. This happens in the existing payment confirmation logic — when the first tax payment is confirmed for a tenancy with `tenancy_type = 'existing_migration'`, flip the status.

## Files Modified
1. **Database migration** — Add `tax_compliance_status` column
2. **`src/pages/landlord/DeclareExistingTenancy.tsx`** — Generate PDF when "Buy" selected, set tax_compliance_status
3. **`src/pages/tenant/MyAgreements.tsx`** — Show existing_declared tenancies, confirm-only flow (no tax), signed PDF generation, tax compliance badge
4. **`src/pages/landlord/Agreements.tsx`** — Tax compliance badge display
5. **`src/pages/regulator/RegulatorAgreements.tsx`** — Tax compliance badge display
6. **`src/components/TenancyCard.tsx`** — Tax compliance indicator

## How It Works
- Landlord declares existing tenancy → chooses "Buy Agreement" → pays fees → tenancy created with generated agreement PDF → tenant sees it in their dashboard
- Tenant reviews and clicks "Confirm" → signed PDF generated → downloadable by all parties
- Tax compliance starts as "Pending" for all existing tenancies → flips to "Verified" when first tax payment is made
- No tax payment is required at the confirmation stage for existing tenancies

