
Goal: fix the real cause of the rent-tax loop and align the agreement rejection behavior with your latest correction.

1. Fix the actual payment failure point
- The problem is not just delay/retry. The database shows recent `rent_tax_bulk` escrow records staying `pending`, and the related `rent_payments` rows remain `pending` with `tenant_marked_paid = false`.
- That means the checkout redirect succeeds, but the payment completion callback is not updating records.
- I will inspect and correct the backend payment completion path so successful Paystack payments reliably:
  - mark the matching `escrow_transactions` row as `completed`
  - mark the correct `rent_payments` rows as `tenant_paid`
  - store `paid_date` and transaction reference
- I will also harden the reference-matching logic for bulk rent tax payments so the tenancy/payment lookup cannot silently miss.

2. Keep the tenant flow from sending people back to pay again
- In `MyAgreements.tsx`, keep the verification step but change it to treat a completed bulk tax payment as valid as soon as either:
  - the matching `rent_payments` are `tenant_paid/confirmed`, or
  - the matching escrow payment is completed
- Add a clearer “payment is still being confirmed” state and prevent the user from being pushed back into another payment attempt while verification is in progress.
- Keep the handoff from Payments → Agreements so a successful return can automatically re-check payment status.

3. Make landlord Agreements remove rejected items from the active list
- The rejection cascade logic already updates tenancy/unit/property state.
- I will change the landlord Agreements screen so rejected agreements are no longer shown in the active/pending agreements list.