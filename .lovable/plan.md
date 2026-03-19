

# Plan: Multiple Tenant/Landlord Portal Fixes

## 1. Tenant Dashboard — "Next Tax Due" → "Next Payment Due"
**File:** `src/pages/tenant/TenantDashboard.tsx` (line 143)
- Change label from `"Next Tax Due"` to `"Next Payment Due"`

## 2. Complaint Fee — Hide payment when fee is off
**File:** `src/pages/tenant/FileComplaint.tsx`
- Already uses `feeConfig = useFeeConfig("complaint_fee")` which provides `enabled` and `amount`
- On review step (step 4, ~line 491): Wrap the fee card in `{feeConfig.enabled && ...}` to hide when disabled
- On submit button (~line 527-529): When `!feeConfig.enabled`, show "Submit Complaint" instead of "Pay GH₵ X & Submit"
- In `handleSubmit` (~line 207): When `feeConfig.enabled` is false, skip the Paystack call entirely — set complaint status to `"submitted"` directly and navigate to my-cases

## 3. Viewing Fee — Hide payment when fee is off
**File:** `src/pages/tenant/Marketplace.tsx`
- Already uses `viewingFeeConfig = useFeeConfig("viewing_fee")`
- Button text (~line 573-576): When `!viewingFeeConfig.enabled`, show "Send Viewing Request" instead of "Pay GH₵ X & Send Viewing Request"
- Fee info text (~line 577): Hide when `!viewingFeeConfig.enabled`
- In `handleRequestViewing` (~line 282): When fee is disabled, skip Paystack call — set viewing request status to `"pending"` directly and show success toast

## 4. Profile — Editable Email & Phone with security
**File:** `src/pages/shared/ProfilePage.tsx`
- **Phone** (line 246): Already editable via the `phone` state. Currently saved to profiles table. Add a confirmation dialog before saving — require current password re-entry for security.
- **Email** (line 249-250): Remove `disabled` and `opacity-60`. Add an "Update Email" flow:
  - Show a dialog asking for new email + current password
  - Call `supabase.auth.updateUser({ email: newEmail })` which sends a confirmation to the new email
  - Show a toast explaining they need to confirm via email link
  - The profile table email updates automatically via Supabase auth hooks

## 5. Tenant Signup — Remove Rent Card statement
**File:** `src/pages/RegisterTenant.tsx` (lines 412-415)
- Delete the `<li>` containing "Your Rent Card will be available at the Rent Control Department within 5 days..."

## 6. Registration Fee — Handle disabled/zero fee gracefully

### Problem
When the fee is set to 0 in Engine Room, Paystack rejects the 0-amount request (non-2xx). When fee is disabled, the edge function returns `{ skipped: true }` but the frontend doesn't handle it properly.

### Backend fix
**File:** `supabase/functions/paystack-checkout/index.ts`
- For `tenant_registration` and `landlord_registration`: When fee amount is 0 (but enabled), treat it like `skipped` — auto-mark `registration_fee_paid = true` and return `{ skipped: true }` instead of calling Paystack with 0 amount

### Frontend fixes

**File:** `src/components/ProtectedRoute.tsx`
- In `handlePay` (~line 150-167): Handle `data.skipped` response — when received, auto-mark registration as paid by calling a verify-payment or directly updating state, then reload
- In the paywall UI (~line 146-212): Use `useFeeConfig` to check if fee is `enabled`. When disabled, skip the paywall entirely (set `feePaid = true`)

**File:** `src/pages/RegisterTenant.tsx`
- In `handlePayRegistration` (~line 38-55): Handle `data.skipped` — navigate to login with success message
- In success screen (~line 411): When fee is disabled, show "Your account is active — proceed to login" instead of the pay button
- Button (~line 428-432): When fee disabled, show "Proceed to Login" button instead of payment button

**File:** `src/pages/RegisterLandlord.tsx`
- Same changes as RegisterTenant above (~lines 398-408)

**File:** `src/pages/tenant/TenantDashboard.tsx`
- Registration fee alert (~line 119-131): Also check `useFeeConfig` enabled status — hide alert