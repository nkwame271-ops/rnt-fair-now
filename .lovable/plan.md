

# Payment & Escrow Architecture Overhaul

## Overview

Replace the current direct-payment system with a ledger-based escrow architecture. All payments pass through escrow, are automatically split per defined rules, and generate verifiable receipts with QR codes. Fee amounts are updated to match the new structure.

---

## 1. Database Migration

### New Tables

**`escrow_transactions`** — Central ledger for all payments
- `id`, `user_id`, `payment_type` (tenant_registration, landlord_registration, rent_card, agreement_sale, rent_tax, rent_payment, rent_combined, complaint_fee, listing_fee, viewing_fee, renewal_payment)
- `reference` (Paystack reference), `paystack_transaction_id`
- `total_amount`, `currency` (default 'GHS')
- `status` (pending, completed, failed, reversed)
- `related_tenancy_id`, `related_complaint_id`, `related_property_id` (nullable FK references)
- `metadata` (jsonb)
- `created_at`, `completed_at`

**`escrow_splits`** — Individual split lines per transaction
- `id`, `escrow_transaction_id` (FK to escrow_transactions)
- `recipient` (rent_control, admin, platform, landlord)
- `amount`, `description`
- `disbursement_status` (pending, released, held)
- `released_at`

**`payment_receipts`** — Verifiable receipts
- `id`, `receipt_number` (unique, auto-generated e.g. `RCT-20260317-XXXX`)
- `escrow_transaction_id` (FK)
- `user_id`, `payer_name`, `payer_email`
- `total_amount`, `payment_type`, `description`
- `split_breakdown` (jsonb — array of {recipient, amount})
- `tenancy_id`, `rent_card_id` (nullable)
- `qr_code_data` (text — URL or verification payload)
- `status` (active, voided, reversed)
- `created_at`

**`landlord_payment_settings`** — Landlord payout preferences
- `id`, `landlord_user_id` (unique)
- `payment_method` (momo, bank)
- `momo_number`, `momo_provider` (MTN, Vodafone, AirtelTigo)
- `bank_name`, `bank_branch`, `account_number`, `account_name`
- `created_at`, `updated_at`

### RLS Policies
- Users read own escrow_transactions, splits, receipts
- Regulators read all
- Landlords manage own payment_settings

### Auto-generate receipt number
Database function `generate_receipt_number()` using a sequence.

---

## 2. Updated Fee Structure & Split Rules

Defined as constants in the checkout edge function:

| Payment Type | Total | Rent Control | Admin | Platform | Landlord |
|---|---|---|---|---|---|
| Tenant Registration | GH₵40 | GH₵15 | GH₵15 | GH₵10 | — |
| Landlord Registration | GH₵30 | GH₵13 | GH₵7 | GH₵10 | — |
| Rent Card | GH₵25 | GH₵15 | GH₵10 | — | — |
| Agreement Sale | GH₵30 | GH₵10 | GH₵20 | — | — |
| Complaint Fee | GH₵2 | — | — | GH₵2 | — |
| Listing Fee | GH₵2 | — | — | GH₵2 | — |
| Viewing Fee | GH₵2 | — | — | GH₵2 | — |
| Rent Tax | 8%/15% | 100% tax | — | — | — |
| Rent Payment | rent amount | — | — | — | 100% (held in escrow) |
| Combined (Tax+Rent) | tax + rent | tax portion | — | — | rent (held) |

---

## 3. Edge Function Updates

### `paystack-checkout/index.ts` — Full rewrite of amount logic
- Update all payment type amounts (tenant: 40, landlord: 30)
- Add new types: `rent_card`, `agreement_sale`, `rent_payment`, `rent_combined`
- Create `escrow_transactions` record with status `pending` before calling Paystack
- Store split plan in metadata

### `paystack-webhook/index.ts` — Full rewrite of post-payment logic
- On `charge.success`: update `escrow_transactions` to `completed`
- Insert `escrow_splits` based on payment type split rules
- Generate `payment_receipts` record with auto-generated receipt number, split breakdown, QR data
- Then perform existing side effects (mark registration paid, update rent_payments, etc.)
- SMS now includes receipt number

---

## 4. Tenant Portal Updates

### `src/pages/tenant/Payments.tsx` — Major update
- Add 3 payment options: "Pay Tax Only", "Pay Rent Only", "Pay Tax + Rent"
- Show receipts list with download/view capability
- Show payment status (escrow held, released, etc.)

### New: `src/pages/tenant/Receipts.tsx`
- List all receipts for the tenant
- Each receipt shows: receipt number, date, amount, type, split breakdown, status
- QR code display + download
- Filter by type/status

---

## 5. Landlord Portal Updates

### New: `src/pages/landlord/PaymentSettings.tsx`
- Form to set MoMo or Bank details
- Save to `landlord_payment_settings`

### Update: `src/pages/landlord/LandlordDashboard.tsx`
- Add rent received summary card
- Add escrow status (held/released amounts)
- Link to receipts

### New: `src/pages/landlord/Receipts.tsx`
- View receipts for transactions involving their tenancies
- Download receipts

---

## 6. Regulator / Admin Portal Updates

### New: `src/pages/regulator/EscrowDashboard.tsx`
- Escrow overview: total held, total released, pending
- Revenue breakdown by recipient (Rent Control, Admin, Platform)
- IGF (Internally Generated Funds) report
- Receipt register with search/filter
- Reconciliation view

### Update: `src/pages/regulator/RegulatorDashboard.tsx`
- Add revenue/escrow stat cards

---

## 7. Receipt Component

### New: `src/components/PaymentReceipt.tsx`
- Reusable receipt card showing: receipt number, date, payer, amount, description
- Split breakdown table (recipient | amount)
- QR code (using `qrcode.react`)
- Status badge
- Print/download button

---

## 8. Navigation & Routing

| Route | Layout | Page |
|---|---|---|
| `/tenant/receipts` | Tenant | Receipts |
| `/landlord/payment-settings` | Landlord | PaymentSettings |
| `/landlord/receipts` | Landlord | Receipts |
| `/regulator/escrow` | Regulator | EscrowDashboard |

Add nav items to all three layouts.

---

## 9. ProtectedRoute Update

Update registration fee amounts: tenant → GH₵40, landlord → GH₵30.

---

## Files Summary

| File | Action |
|---|---|
| DB migration | Create `escrow_transactions`, `escrow_splits`, `payment_receipts`, `landlord_payment_settings`; add RLS; create `generate_receipt_number()` function |
| `supabase/functions/paystack-checkout/index.ts` | Rewrite — new amounts, new types, create escrow record before payment |
| `supabase/functions/paystack-webhook/index.ts` | Rewrite — escrow completion, split insertion, receipt generation |
| `src/pages/tenant/Payments.tsx` | Update — 3 payment options (tax/rent/combined), receipt links |
| `src/pages/tenant/Receipts.tsx` | Create — receipt list with QR and download |
| `src/pages/landlord/PaymentSettings.tsx` | Create — MoMo/bank settings form |
| `src/pages/landlord/Receipts.tsx` | Create — landlord receipt viewer |
| `src/pages/landlord/LandlordDashboard.tsx` | Update — rent received + escrow status cards |
| `src/pages/regulator/EscrowDashboard.tsx` | Create — escrow overview, revenue, IGF, receipts |
| `src/pages/regulator/RegulatorDashboard.tsx` | Update — revenue stat cards |
| `src/components/PaymentReceipt.tsx` | Create — reusable receipt component with QR |
| `src/components/ProtectedRoute.tsx` | Update — new fee amounts |
| `src/components/TenantLayout.tsx` | Update — add Receipts nav |
| `src/components/LandlordLayout.tsx` | Update — add Payment Settings + Receipts nav |
| `src/components/RegulatorLayout.tsx` | Update — add Escrow Dashboard nav |
| `src/App.tsx` | Update — add 4 new routes |

