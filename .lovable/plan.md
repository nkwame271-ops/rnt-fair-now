

# Plan: Add Comprehensive Error Handling & Logging for Payout System

## Summary

Create a `payment_processing_errors` database table to log every error that occurs during payment processing, payout transfers, and escrow operations. Then add structured error logging throughout the three key edge functions so admins can see exactly what went wrong and where.

---

## Changes

### 1. Database Migration — Create `payment_processing_errors` table

A dedicated error log table:
- `id` (uuid, PK)
- `escrow_transaction_id` (uuid, nullable) — links to the transaction
- `reference` (text) — Paystack reference
- `function_name` (text) — which edge function errored (e.g. "paystack-webhook", "verify-payment", "process-office-payout")
- `error_stage` (text) — where it failed (e.g. "escrow_completion", "recipient_creation", "transfer_initiation", "split_recording", "receipt_creation", "notification", "sms", "type_finalization")
- `error_message` (text) — the error message
- `error_context` (jsonb) — additional context (payment_type, user_id, split_recipient, amount, Paystack response, etc.)
- `severity` (text) — "critical" / "warning" / "info"
- `resolved` (boolean, default false) — for admin to mark as handled
- `created_at` (timestamptz)

RLS: service_role insert, regulator read access.

### 2. Update `paystack-webhook/index.ts`

Add a `logError()` helper that inserts into `payment_processing_errors`. Wrap each major operation in try/catch with structured error logging:

- **Signature verification failure** → log with severity "critical"
- **Escrow completion** (`completeEscrow`) → wrap split insertion, receipt creation in individual try/catch; log failures with stage + context
- **Recipient creation** (`getOrCreateRecipient`) → log Paystack API response on failure with the account details attempted
- **Transfer initiation** (`initiateTransfer`) → log Paystack error response, amount, recipient
- **Payment-type finalization** (registration updates, rent card creation, complaint status) → wrap each in try/catch, log with stage "type_finalization"
- **Notification/SMS/Email** — already wrapped, add `logError()` calls alongside `console.error`
- **Transfer event handling** (transfer.failed/reversed) → log with severity "critical"

Also notify main admins (in-app notification) when a "critical" error occurs.

### 3. Update `verify-payment/index.ts`

Same `logError()` pattern:
- Paystack API verification failure → log
- Escrow update failure → log  
- Type-specific finalization failures → log each with stage
- Receipt creation failure → log
- Payout trigger failures → log (currently swallowed with just `console.error`)

### 4. Update `process-office-payout/index.ts`

- Recipient creation failure → log with office_id context
- Transfer initiation failure → log with amount, recipient, Paystack response
- Balance calculation errors → log

### 5. Admin UI — Error Log Viewer (New page: `regulator/PaymentErrors.tsx`)

A simple table in the regulator dashboard showing:
- Timestamp, function, stage, severity, message, reference
- Filter by severity (critical/warning/info) and resolved status
- Click to expand full error context JSON
- "Mark Resolved" button per row
- Add route and nav link in RegulatorLayout

---

## Technical Details

The `logError()` helper used in all three functions:

```typescript
const logError = async (db, opts: {
  escrow_transaction_id?: string;
  reference?: string;
  function_name: string;
  error_stage: string;
  error_message: string;
  error_context?: Record<string, any>;
  severity?: string;
}) => {
  try {
    await db.from("payment_processing_errors").insert({
      ...opts,
      severity: opts.severity || "warning",
    });
  } catch (e) {
    console.error("Failed to log error:", e);
  }
};
```

Each existing `console.error` call gets an accompanying `logError()` call with appropriate stage and context. The `console.error` calls are kept for edge function logs.

---

## Files to Create/Modify

| File | Change |
|---|---|
| **Migration** | Create `payment_processing_errors` table with RLS |
| `paystack-webhook/index.ts` | Add `logError()` helper; wrap all operations with structured error capture |
| `verify-payment/index.ts` | Add `logError()` helper; wrap all operations with structured error capture |
| `process-office-payout/index.ts` | Add `logError()` helper; wrap recipient/transfer operations |
| **New:** `src/pages/regulator/PaymentErrors.tsx` | Error log viewer with filters and resolve action |
| `src/components/RegulatorLayout.tsx` | Add nav link for Payment Errors page |
| `src/App.tsx` | Add route for `/regulator/payment-errors` |

