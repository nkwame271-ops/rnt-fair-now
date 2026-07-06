## Goal
Stop payment triggers from navigating to an empty/blank page and make every payment flow stay inside the branded in-app checkout, then land on the branded confirmation screen.

## Plan
1. **Remove hosted-page fallback navigation**
   - Update the branded checkout host so it never redirects users to the processor `authorization_url` when inline checkout cannot open.
   - Instead, show a clear in-app error/toast such as “Secure payment is temporarily unavailable. Please try again.”

2. **Make checkout payload validation explicit**
   - Validate required fields before opening the modal: `reference`, `publicKey`, `amount`, and `email`.
   - If a payload is incomplete, keep the user on the same app screen and show a useful error instead of allowing a blank/processor page.

3. **Fix the post-payment confirmation handoff**
   - Keep Paystack Inline’s successful callback inside the app by navigating to `/payments/confirm?ref=...&next=...`.
   - Preserve the existing polling verification on the confirmation screen so slower payment finalization does not show an empty page.

4. **Normalize all payment callsites**
   - Replace “No checkout URL received” assumptions with “No secure checkout details received” because the app should no longer depend on visible hosted URLs.
   - Check all `paystack-checkout` callsites so every payment type calls `startBrandedCheckout(...)` and none sends users to Paystack-hosted pages.

5. **Backend response cleanup**
   - Keep `authorization_url` available internally for legacy compatibility, but make the frontend depend on the inline fields returned by `paystack-checkout`.
   - Ensure the checkout function always returns the public key and branded invoice details needed by the modal.

6. **Verify**
   - Run a focused source scan for remaining visible hosted Paystack navigation.
   - Validate with the live preview that clicking a payment opens the branded modal instead of an empty page, and that success routes to the confirmation page.