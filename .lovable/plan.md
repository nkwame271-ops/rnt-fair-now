

# Payment Error Handling, Success Notifications & SMS/Notification Alerts

## Current State

- **Webhook** (`paystack-webhook`): Handles `charge.success` events only. No handling for `charge.failed`. SMS is sent on success but no in-app notification for most payment types (only renewal creates notifications).
- **Checkout** (`paystack-checkout`): Returns errors to the client but no escrow status update on failure.
- **Client-side**: Only `Payments.tsx` checks for `?status=cancelled`. Other pages (ProtectedRoute for registration, ManageRentCards, Marketplace, etc.) don't handle failure callbacks. No unified payment callback handling.
- **No `charge.failed` webhook handler**: If Paystack sends a failure event, it's silently ignored.

## Plan

### 1. Webhook: Handle `charge.failed` event
**File**: `supabase/functions/paystack-webhook/index.ts`

- Add handling for `body.event === "charge.failed"` alongside `charge.success`
- On failure: update the matching `escrow_transactions` record to `status: "failed"`
- Insert a notification into the `notifications` table so the user sees "Payment failed" in-app
- Send an SMS to the user: "Your payment of GH₵ X for Y failed. Please try again."

### 2. Webhook: Add in-app notifications on success for all payment types
**File**: `supabase/functions/paystack-webhook/index.ts`

Currently only renewal creates notifications. Add `notifications` inserts for:
- Registration (tenant/landlord): "Registration payment confirmed! Your account is now active."
- Rent tax (single/bulk): "Rent tax payment of GH₵ X confirmed."
- Rent card purchase: "X Rent Card(s) purchased successfully."
- Agreement sale, complaint fee, listing fee, viewing fee: appropriate success messages

### 3. Client-side: Unified payment callback handling on all return pages
Add `?status=cancelled` / `?status=failed` query param handling to pages that initiate payments but don't currently handle failure returns:

- **`src/components/ProtectedRoute.tsx`**: After polling fails (max attempts reached), show a "Payment could not be confirmed" message with a retry button instead of silently falling back to the paywall.
- **`src/pages/landlord/ManageRentCards.tsx`**: Handle `?status=success` and `?status=cancelled` callbacks.
- **`src/pages/tenant/Marketplace.tsx`**: Already handles `viewing_paid` — add `cancelled` handling.
- **`src/pages/landlord/MyProperties.tsx`**: Handle listing fee callback.
- **`src/pages/tenant/MyCases.tsx`**: Handle complaint fee callback.

### 4. Webhook: Send SMS on all successful payments (already partially done)
Verify all branches call `sendPaymentSms`. Currently missing for: `complaint_fee`, `listing_fee`, `viewing_fee`. Add SMS for those.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/paystack-webhook/index.ts` | Add `charge.failed` handler, add notifications on all success paths, add SMS for complaint/listing/viewing |
| `src/components/ProtectedRoute.tsx` | Better failure messaging when polling exhausted |
| `src/pages/landlord/ManageRentCards.tsx` | Add payment callback handling |
| `src/pages/tenant/Marketplace.tsx` | Add cancelled callback |
| `src/pages/landlord/MyProperties.tsx` | Add listing fee callback |
| `src/pages/tenant/MyCases.tsx` | Add complaint fee callback |

