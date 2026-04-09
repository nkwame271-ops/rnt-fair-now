

# System Audit — Final Gap Validation & Fix Plan

## Audit Results (12 Reconciliation Items + 8 Feature Items)

---

### RECONCILIATION & STOCK INTEGRITY

| # | Item | Status | Gap |
|---|------|--------|-----|
| 1 | Pair model (÷2 removal) | **DONE** | Reconciliation uses `COUNT(DISTINCT purchase_id)` — no ÷2 logic |
| 2 | Event-specific timestamps | **DONE** | `unassigned_at`, `assigned_at`, `created_at` all exist on stock table |
| 3 | State-based unassign tracking | **DONE** | Uses `unassigned_at` column, not `admin_audit_log` |
| 4 | Stock accounting formula | **DONE** | Formula implemented in `OfficeReconciliation.tsx` line 197 |
| 5 | Adjustment stock flagging | **DONE** | `stock_source` column exists with values `generation/adjustment/upload` |
| 6 | Safe decrease logic | **DONE** | `inventory_adjustment_atomic` RPC uses FIFO + adjustment-first ordering |
| 7 | Concurrency protection | **DONE** | RPC uses `SELECT FOR UPDATE`; assignment/unassignment already atomic |
| 8 | Idempotency for admin actions | **DONE** | `idempotency_key` column + check in RPC |
| 9 | Negative stock validation | **DONE** | RPC raises exception if `available < requested` |
| 10 | +149 correction traceability | **DONE** | `reference_id` + `correction_tag` fields on `inventory_adjustments` + UI in OfficeAllocation |
| 11 | Historical consistency | **DONE** | `reconciliation_period_snapshots` table + "Save Period Snapshot" button |
| 12 | Unassign/reassign integrity | **DONE** | Atomic RPCs with `FOR UPDATE`; existing unique constraint sufficient |

### LANDLORD & TENANT FEATURES

| # | Item | Status | Gap |
|---|------|--------|-----|
| 13 | PDF with real property data | **DONE** | Enhanced `AgreementPdfData` with GPS, amenities, conditions, "Assessed Recoverable Rent" |
| 14 | Clickable entity names | **DONE** | Links in `RegulatorAgreements.tsx` |
| 15 | Vacant/Occupied registration | **DONE** | `occupancyStatus` toggle in `RegisterProperty.tsx` with redirect |
| 16 | Flexible advance field | **DONE** | Numeric `<Input>` in `DeclareExistingTenancy.tsx` |
| 17 | **Placeholder tenant bug** | **GAP** | `claim_pending_tenancy` called from `RegisterTenant.tsx` but NOT implemented in `admin-action` edge function. Tenants who register after being invited will never see their tenancy. |
| 18 | Rent lock after declaration | **DONE** | `occupiedUnitIds` + `readOnly` + lock icon in `EditProperty.tsx` |
| 19 | Tenancy expiry automation | **DONE** | `tenancy-expiry-check` edge function handles auto-expiry, off-market, notifications |
| 20 | Rent review sync | **DONE** | `RegulatorRentReviews.tsx` updates both `units.monthly_rent` and `tenancies.agreed_rent` |

### QR & AUDIO

| # | Item | Status | Gap |
|---|------|--------|-----|
| 21 | QR code verification | **MOSTLY DONE** | Agreement PDF uses correct URL. **BUT** `generateTenancyCardPdf.ts` line 81 still uses old URL: `www.rentcontrolghana.com/verify-tenancy/` — needs fix |
| 22 | Verify page expanded data | **DONE** | `verify-tenancy` edge function returns property, unit, signing dates, agreement status |
| 23 | Audio MIME detection | **DONE** | All 4 recording files use `isTypeSupported` with webm/mp4/ogg fallback |
| 24 | Audio playback in admin | **DONE** | `RegulatorComplaints.tsx` and `RegulatorApplications.tsx` have `<audio>` controls |

---

## GAPS TO FIX (2 items)

### Gap 1: `claim_pending_tenancy` — Missing Backend Handler

**Problem**: `RegisterTenant.tsx` line 227 calls `supabase.functions.invoke("admin-action", { body: { action: "claim_pending_tenancy", phone, new_user_id } })` — but this case does NOT exist in `admin-action/index.ts`. The call silently fails (caught by try/catch). This means tenants invited by landlords via "Declare Existing Tenancy" will register but never get linked to their pending tenancy. Their dashboard will be empty.

**Fix**: Add a `case "claim_pending_tenancy"` to `admin-action/index.ts` that:
1. Receives `phone` and `new_user_id` from the body (no password required — this runs during registration)
2. Queries `pending_tenants` for matching phone number with `status = 'pending'`
3. For each match, updates `tenancies.tenant_user_id` to the new user ID
4. Marks `pending_tenants.status = 'claimed'`
5. Returns count of claimed tenancies

This case should NOT require admin role or password since it's called during tenant registration.

### Gap 2: Tenancy Card PDF — Wrong Verify URL

**Problem**: `src/lib/generateTenancyCardPdf.ts` line 81 uses the old URL `www.rentcontrolghana.com/verify-tenancy/` instead of `https://rentghanapilot.lovable.app/verify-tenancy/`.

**Fix**: Update the URL to match the agreement PDF pattern.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/admin-action/index.ts` | Add `claim_pending_tenancy` case (no password/admin check) |
| `src/lib/generateTenancyCardPdf.ts` | Fix verify URL on line 81 |

Everything else is already correctly implemented across the system.
