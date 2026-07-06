## Problem

On mobile, when the secure payment window opens and shows Card / Mobile Money / Bank options, tapping the options does nothing. On desktop the same UI works with a mouse. This is a mobile-only interaction bug, not a payment/verification bug.

## Root cause

Our branded "Secure payment" dialog (`BrandedCheckoutHost`) uses the shadcn `Dialog`, which is a Radix modal. When the user taps "Pay securely", we call `new PaystackPop().resumeTransaction(...)` **while our Dialog is still open**. On mobile browsers this causes two problems:

1. Radix Dialog installs a full-screen overlay with `pointer-events` management and a focus trap on the dialog content. The payment provider's popup is rendered outside our Dialog's DOM subtree, so on touch devices the overlay / focus trap swallows taps that land on the provider's option buttons. On desktop, mouse clicks behave differently (Radix's outside-click logic still lets them through in some cases), which is why it works with a mouse but not a finger.
2. Radix also locks body scroll and sets `aria-hidden` on siblings of the Dialog, which further breaks the payment popup's own touch handling on iOS Safari and Android Chrome.

There is nothing wrong with the payment provider's popup itself — the same popup works when it is not rendered underneath a Radix modal.

## Fix (frontend only, no business logic changes)

Close our branded Dialog the moment we hand control to the payment popup, so the provider's popup is the only modal on screen.

### Changes in `src/components/payments/BrandedCheckoutHost.tsx`

1. In `pay()`, right before calling `resumeTransaction` / `setup`, snapshot the current payload into a local variable and call `setPayload(null)` so our Dialog unmounts and its overlay / focus trap / body-scroll lock are removed.
2. Keep `processing` state on a small, separate lightweight indicator (or just rely on the payment popup being visible) — do not keep the Radix Dialog mounted while the payment popup is open.
3. `finishPayment` already navigates away, so no further Dialog cleanup is needed on success.
4. On `onCancel` from the payment popup, re-open our branded Dialog by calling `setPayload(snapshot)` again so the user can retry, and clear `processing`.
5. On `onError`, do the same as cancel but also set `errorMsg` so the alert re-appears when the Dialog re-opens.
6. For the legacy v1 fallback path (`setup(...).openIframe()`), apply the same pattern: close our Dialog before `openIframe()`, restore on `onClose` without success.

### Why this is safe

- No changes to reference generation, `access_code` handling, verification, or webhook logic.
- No changes to `startBrandedCheckout`, `loadPaystackInline`, or the edge functions.
- Only the presentation layer is touched, matching the reported symptom (mobile tap not registering on payment method selection).

## Verification

1. Build passes.
2. Manually trigger a payment on a mobile viewport in the preview: confirm the branded dialog closes when "Pay securely" is tapped, the provider popup opens, and Card / Mobile Money / Bank options are tappable.
3. Cancel the popup: confirm our branded dialog re-appears so the user can retry.
4. Complete a payment: confirm navigation to `/payments/confirm?ref=...` still happens.

## Files to change

- `src/components/payments/BrandedCheckoutHost.tsx` (only)
