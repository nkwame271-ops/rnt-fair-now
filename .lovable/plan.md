

# Plan: Payment Fix, Archive Fee Visibility, Rejection Cascade, Office Wallet System

## 1. Fix Payment Verification (Root Cause: Auth + Category Mismatch)

**Problem confirmed**: Zero logs on both `paystack-webhook` and `verify-payment`. The webhook is not receiving events from Paystack (likely webhook URL not configured). The backup `verify-payment` function requires a valid auth session (lines 14-24) — after Paystack redirect, the session token may be expired or not yet restored, causing the function to throw "Not authenticated" before doing anything useful. All 10+ `rent_tax_bulk` escrow records remain stuck at `pending`.

**Fix**: Make `verify-payment` work without requiring user authentication for the verification step. The function already has `verify_jwt = false`. We'll add a secondary code path: when no valid auth header is present, still allow verification using just the reference (the reference is unique and unguessable). The function will:
- Try to authenticate the user as before (for ownership validation)
- If auth fails, fall back to verifying with just the reference — still validate against Paystack API and finalize the escrow/payments using the service role client
- This ensures post-redirect verification works even if the session isn't fully restored

**Files**: `supabase/functions/verify-payment/index.ts`

Additionally, improve the client-side flow in `Payments.tsx`:
- After redirect, if `verify-payment` succeeds, explicitly clear all sessionStorage flags and show clear success feedback before reloading
- If it fails, retry once after a 3-second delay before giving up

**Files**: `src/pages/tenant/Payments.tsx`, `src/pages/tenant/MyAgreements.tsx`

---

## 2. Archive Search Fee Not Visible in Engine Room

**Problem confirmed**: The `archive_search_fee` flag has `category = 'fees'` in the database, but Engine Room filters by `category === "fee"` (line 168). The flag is invisible.

**Fix**: Update the database record to change category from `fees` to `fee` so it matches the Engine Room filter.

**Action**: Database UPDATE via insert tool.

---

## 3. Tenancy Rejection Cascade (Already Implemented)

**Current state**: The rejection cascade in `MyAgreements.tsx` (lines 123-171) already:
- Sets tenancy status to `rejected`
- Resets unit to `vacant`
- Sets property back to `live` with `listed_on_marketplace = true` (if no other occupied units)

The landlord `Agreements.tsx` already filters rejected tenancies out of the active list (line 144) and shows them in a collapsible section.

**No code changes needed** — this is working correctly.

---

## 4. Office Wallet & Fund Request System (New Feature)

**Design**: Each office accumulates a virtual escrow balance from its share of transactions (the "admin" split). Offices cannot access funds directly — they submit withdrawal requests reviewed by the main admin.

### Database Changes

**New table: `office_fund_requests`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| office_id | text | FK to offices |
| requested_by | uuid | Staff user who submitted |
| amount | numeric | Requested amount |
| purpose | text | Reason for request |
| status | text | pending / approved / rejected |
| reviewed_by | uuid | Main admin who reviewed |
| reviewed_at | timestamptz | |
| reviewer_notes | text | |
| payout_reference | text | Paystack transfer ref (after payout) |
| created_at | timestamptz | |

**New table: `office_payout_accounts`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| office_id | text | FK to offices, unique |
| payment_method | text | momo or bank |
| momo_number | text | |
| momo_provider | text | |
| bank_name | text | |
| account_number | text | |
| account_name | text | |
| updated_at | timestamptz | |

RLS: Regulators can read/manage both tables. Service role has full access.

### Backend

**New edge function: `process-office-payout`**
- Called when main admin approves a fund request
- Calculates office's available balance (sum of "admin" splits for that office minus previously approved requests)
- Validates requested amount does not exceed available balance
- Uses Paystack Transfer API to send funds to the office's payout account
- Updates the fund request status and stores the payout reference

### Frontend

**New page: `src/pages/regulator/OfficeFundRequests.tsx`**
- Sub admins see: their office's balance (computed from escrow_splits), a form to submit a fund request, and history of their requests
- Main admins see: all pending requests across offices, approve/reject with notes, office balance summaries, and payout history
- Add to regulator navigation and routes

**New page: `src/pages/regulator/OfficePayoutSettings.tsx`**
- Each office configures its payout account (momo or bank details)
- Accessible to sub admins for their own office, main admins for any office

---

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/verify-payment/index.ts` | Add auth-optional fallback path for reference-based verification |
| `src/pages/tenant/Payments.tsx` | Improve retry logic after verify-payment call |
| `src/pages/tenant/MyAgreements.tsx` | Minor: clear flags more reliably after verification |
| Database (UPDATE) | Change `archive_search_fee` category from `fees` to `fee` |
| Database (CREATE) | `office_fund_requests` and `office_payout_accounts` tables with RLS |
| `supabase/functions/process-office-payout/index.ts` | New edge function for payout processing |
| `src/pages/regulator/OfficeFundRequests.tsx` | New page for fund request workflow |
| `src/pages/regulator/OfficePayoutSettings.tsx` | New page for office payout account config |
| `src/components/RegulatorLayout.tsx` | Add nav links for new pages |
| `src/App.tsx` | Add routes for new pages |

