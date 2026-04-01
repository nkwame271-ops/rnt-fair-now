

# Plan: Configurable Split Engine, System Settlement Accounts, and Office Payout Mode

## Summary

This plan introduces a fully configurable split engine stored in the database, adds system settlement account management, and adds an Office Payout Mode toggle (manual vs auto-release) — all editable from the Engine Room without developer intervention.

---

## Current State

- **Splits are hardcoded** in `paystack-checkout/index.ts` as `DEFAULT_SPLIT_RULES` (lines 11-71) and `calculateRegistrationSplits` (lines 74-90). The webhook reads splits from escrow metadata (`split_plan`) stored at checkout time.
- **Engine Room** manages feature flags and fees but has no split configuration UI.
- **Payout Settings** (`OfficePayoutSettings.tsx`) only manages office accounts. No system-level settlement accounts exist.
- **Escrow Dashboard** shows allocations but doesn't distinguish auto-released vs manually released funds.
- **Office Fund Requests** page handles manual approval workflow.

---

## Database Changes

### 1. New table: `split_configurations`

Stores the split rules per payment type, editable from Engine Room.

```sql
CREATE TABLE public.split_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type text NOT NULL,
  recipient text NOT NULL,        -- 'platform', 'rent_control', 'admin', 'gra', 'landlord'
  amount_type text NOT NULL DEFAULT 'flat',  -- 'flat' or 'percentage'
  amount numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_platform_fee boolean NOT NULL DEFAULT false,  -- marks the fixed platform fee line
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(payment_type, recipient, sort_order)
);
```

Seed with current hardcoded values for all payment types.

### 2. New table: `secondary_split_configurations`

For IGF and Admin sub-splits (office / headquarters / platform portions).

```sql
CREATE TABLE public.secondary_split_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_recipient text NOT NULL,  -- 'rent_control' or 'admin'
  sub_recipient text NOT NULL,     -- 'office', 'headquarters', 'platform'
  percentage numeric NOT NULL DEFAULT 0,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(parent_recipient, sub_recipient)
);
```

### 3. New table: `system_settlement_accounts`

For IGF, Admin, Platform, GRA settlement account details.

```sql
CREATE TABLE public.system_settlement_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL UNIQUE,  -- 'igf', 'admin', 'platform', 'gra'
  payment_method text NOT NULL DEFAULT 'bank',
  account_name text,
  bank_name text,
  account_number text,
  momo_number text,
  momo_provider text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
```

### 4. Feature flag for Office Payout Mode

Insert a new feature flag: `office_payout_mode` with `description: "Auto Release or Manual Approval"`. Use `is_enabled = false` for Manual (default), `true` for Auto Release.

### 5. Add `release_mode` column to `escrow_splits`

```sql
ALTER TABLE public.escrow_splits ADD COLUMN release_mode text NOT NULL DEFAULT 'manual';
-- Values: 'manual', 'auto'
```

### 6. RLS Policies

All new tables: SELECT + ALL for `regulator` role, ALL for `service_role`.

---

## Backend Changes

### `paystack-checkout/index.ts`

Replace `DEFAULT_SPLIT_RULES` and `calculateRegistrationSplits` with a DB lookup function:
- Query `split_configurations` for the payment type
- If `is_platform_fee` row exists, extract that first
- Apply remaining splits from the config rows
- Fall back to current hardcoded values if no DB config found
- Store the computed `split_plan` in escrow metadata (already done)

### `paystack-webhook/index.ts`

In `completeEscrow` helper (line 111):
- After inserting splits, check the `office_payout_mode` feature flag
- If auto-release is enabled, for splits with `recipient = 'admin'`:
  - Set `disbursement_status = 'released'`, `released_at = now()`, `release_mode = 'auto'`
  - Auto-create an approved `office_fund_requests` record
  - Trigger Paystack transfer to the office payout account (reuse logic from `process-office-payout`)
- If manual mode, keep current behavior (`disbursement_status = 'pending'`)

### `process-office-payout/index.ts`

No structural changes needed — already handles the payout flow.

---

## Frontend Changes

### 1. Engine Room — Split Configuration Section (`EngineRoom.tsx`)

Add a new "Split Engine" section (main admin only):
- For each payment type, show a card with the split lines (recipient, amount/percentage, description)
- Editable inline with Save button per payment type
- Secondary split config for IGF and Admin (office/HQ/platform percentages)
- "Office Payout Mode" toggle at the top: Manual Approval vs Auto Release

### 2. Payout Settings — System Settlement Accounts (`OfficePayoutSettings.tsx`)

Add a "System Settlement Accounts" subsection below the office accounts:
- Four account cards: IGF, Admin, Platform, GRA
- Each with payment method (MoMo/Bank), account details
- Same form pattern as existing office payout accounts

### 3. Escrow Dashboard — Release Mode Indicators (`EscrowDashboard.tsx`)

Add to the dashboard:
- New stat cards: "Auto-Released" and "Manually Released" totals
- Filter or badge on the office revenue table showing release mode
- Query `escrow_splits.release_mode` to compute these values

---

## Files to Change

| File | Change |
|---|---|
| New migration | Create `split_configurations`, `secondary_split_configurations`, `system_settlement_accounts` tables; add `release_mode` to `escrow_splits`; seed split data; insert `office_payout_mode` feature flag |
| `supabase/functions/paystack-checkout/index.ts` | Replace hardcoded splits with DB lookup from `split_configurations` |
| `supabase/functions/paystack-webhook/index.ts` | Add auto-release logic in `completeEscrow` based on payout mode flag |
| `src/pages/regulator/EngineRoom.tsx` | Add Split Engine configuration UI and Payout Mode toggle |
| `src/pages/regulator/OfficePayoutSettings.tsx` | Add System Settlement Accounts subsection |
| `src/pages/regulator/EscrowDashboard.tsx` | Add auto-released vs manually-released stats |

