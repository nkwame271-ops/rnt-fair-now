**Problem found**

The checkout is not failing at Paystack initialization. Recent backend logs show Paystack successfully created checkout sessions and returned `authorization_url`, `access_code`, and `reference`.

The failure is happening after that, inside the app, because `startBrandedCheckout()` rejects the returned payload when any of these are missing:

```text
reference + publicKey + email + amount
```

In this flow the most likely missing field is `publicKey`. The backend currently returns:

```text
publicKey: Deno.env.get("PAYSTACK_PUBLIC_KEY") || null
```

So if the public key is empty, unavailable to the deployed function runtime, or not validated before responding, the frontend receives a successful backend checkout response but refuses to open the branded modal. That directly matches the screenshot errors:

```text
Secure checkout details are incomplete. Please try again.
No secure checkout details received
```

There is also a second issue: the frontend masks which field is missing, so we had to infer from code and logs instead of the UI telling us the real problem.

**Fix plan**

1. **Make the backend fail clearly when inline checkout cannot work**
   - In `paystack-checkout`, validate `PAYSTACK_PUBLIC_KEY` before returning checkout data.
   - If it is missing or malformed, return a clear branded error like: `Secure payment is not configured correctly. Please contact support.`
   - Do not return a partial payload that the frontend later rejects.

2. **Return an explicit branded checkout payload**
   - Build a `checkout` object with all required fields: `reference`, `publicKey`, `amount`, `currency`, `email`, `description`, `invoiceId`, `callbackPath`, `customerName`.
   - Keep `authorization_url` for internal traceability if needed, but do not depend on it or expose it in UI.

3. **Improve frontend validation without leaking processor details**
   - Update `hasBrandedCheckoutDetails()` to report which required field is missing for debugging.
   - Update callers so the user sees one clear error instead of two stacked toasts.
   - Keep wording neutral: “Secure payment could not start.”

4. **Add edge-function diagnostics that do not expose secrets**
   - Log whether the public key is present and whether it looks like a public key, but never log the key value.
   - This will make future payment failures obvious from backend logs.

5. **Deploy and verify the actual signal**
   - Deploy the checkout function.
   - Check recent backend logs after a payment click.
   - Confirm the app either opens the branded modal or shows the new precise visible error, instead of the current incomplete-details loop.