

## Audit results — what's actually broken

I queried the live ledger. The most recent rent_card_bulk transaction (total GHS 250, primary plan: rent_control 150 + admin 100) produced **5 ledger rows totaling GHS 300** with descriptions like `"Admin … (office share) (office share)"` and `"… (office share) (HQ share)"`. That proves the secondary split is being applied **twice** to the admin bucket.

### Bug 1 — Double secondary-split on admin (CRITICAL)
- `finalize-payment.ts` correctly runs `expandAdminSplit` once → emits `admin 50 (office) + admin_hq 50 (HQ)`.
- `finalize-office-attribution/index.ts` then ALSO sub-splits any `recipient='admin'` rows it finds again (line 93: `splitAmount * officePct/100`), producing another 25/25 pair. Net: ledger over-posts admin by 50%.
- Office-attribution must only **re-tag** the already-split office-share row with the resolved `office_id` and flip status from `deferred → pending_transfer`. It must NOT re-apply the percentage and must NOT create another HQ row (HQ row already exists from finalize-payment).

### Bug 2 — `rent_control` posted to assigning office instead of HQ
- In the ledger, `rent_control 150` carries `office_id='accra_central'`. But `secondary_split_configurations` says `rent_control` is 100% headquarters / 0% office. Non-admin recipients in `finalize-payment.ts` (line 280) blindly inherit `officeId`. We need the same secondary-split treatment for `rent_control` (and any future parent_recipient with secondary config) so the row reflects HQ, not the originating office.

### Bug 3 — Reconciliation does not detect/repair these specific corruptions
- `reconcile-internal-ledger` only **adds missing rows**; it never removes duplicates or corrects mis-attributed `office_id`. After the code fix it must also be able to mark obvious duplicate over-postings (e.g. the doubled `(office share) (office share)` rows) as `voided` so historical totals reconcile to the actual amount paid.

### What IS already correct (no change)
- `loadAllocation` in `paystack-checkout` reads Engine Room (no hardcoded office routing). ✅
- `expandAdminSplit` math in `finalize-payment.ts` is correct (uses full primary admin amount). ✅
- `OfficePayoutSettings.tsx` auto-calls `admin-action create_payout_recipient` / `create_settlement_recipient` after every save and clears stale `paystack_recipient_code` when bank/momo details change. ✅
- All payout call sites use `paystack_recipient_code` (auto-create-and-cache pattern). ✅
- Ledger posting happens immediately after verification regardless of payout success — failed transfers are written to `payout_transfers` with `status='failed'` but the `escrow_splits` rows still exist. ✅

## Fix plan

### 1. `supabase/functions/finalize-office-attribution/index.ts` — stop double-splitting
Replace the loop that sub-splits deferred admin rows with a simple **re-tag**:
- For each row found with `recipient='admin'` AND `disbursement_status='deferred'`: just set `office_id = office_id` and `disbursement_status = 'pending_transfer'`. Do NOT recompute amount. Do NOT insert an HQ row (the HQ row was already created by `finalize-payment.expandAdminSplit`).
- Keep the office payout (Paystack transfer) logic — it should sum `officeSplitIds` amounts as-is.
- Remove the entire `hqPct > 0` insertion block and the post-loop HQ payout block.

### 2. `supabase/functions/_shared/finalize-payment.ts` — apply secondary split to `rent_control` too
- Generalize `expandAdminSplit` into `expandSecondarySplit(item, parentRecipient, …)` that:
  - Looks up `secondary_split_configurations` for the row's `recipient` (admin OR rent_control).
  - If config exists: emit `office`-share row tagged with `officeId` (recipient stays `admin` or `rent_control`) + `headquarters`-share row with `recipient = '<parent>_hq'` (i.e. `admin_hq`, `rent_control_hq`) and `office_id = null`.
  - Add `rent_control_hq` to `RECIPIENT_TO_ACCOUNT_TYPE` mapping → `"igf"` (same settlement account as `rent_control`).
- Cache both `adminSecondarySplits` and `rentControlSecondarySplits` once at top of `finalizePayment`.
- Apply to both the bundle-children loop and the main `splits.length === 0` block.

### 3. `supabase/functions/reconcile-internal-ledger/index.ts` — detect & quarantine duplicates
- After computing `expected` rows, compute `actualTotal = sum(existing.amount)` and `expectedTotal = sum(expected.amount)`.
- If `actualTotal > expectedTotal + 0.5`: identify rows whose description contains `" (office share) (office share)"` or `" (office share) (HQ share)"` (the smoking-gun pattern) and mark them with `disbursement_status='voided'` + append `" [DUPLICATE — reconciler]"` to description. Never delete; never touch rows with an existing successful `payout_transfers` entry (`status='pending'` or `'success'`).
- Add the void count to the response summary so admins can see how much was quarantined per run.
- Also fix mis-attributed `office_id` on `rent_control` rows: where `secondary_split_configurations` says office%=0, set those rows' `office_id = null` (skip if a successful payout already exists for that split).

### 4. Generalize `expandSecondarySplit` for future parent recipients
- Update `RECIPIENT_TO_ACCOUNT_TYPE` to map both `admin_hq → "admin"` and `rent_control_hq → "igf"`.
- Pre-load secondary splits for every distinct recipient in the primary `splitPlan` in one query (`.in('parent_recipient', recipients)`).

## Verification after fix
1. Trigger a fresh `rent_card_bulk` payment; confirm exactly 4 ledger rows: `rent_control` (HQ, office_id=null), `rent_control_hq`-or-equivalent (skipped if 100% HQ → just one rent_control row tagged HQ), `admin (office)`, `admin_hq (HQ)`. Sum = total paid.
2. Run `reconcile-internal-ledger` with a backfill window covering the past 7 days; verify it voids the `(office share) (office share)` duplicates and reports a non-zero `voided_count`.
3. Re-query the affected escrow ids; confirm the sum of non-voided splits == `total_amount`.

## Files to edit
- `supabase/functions/_shared/finalize-payment.ts` — generalize secondary expansion, add `rent_control_hq` mapping
- `supabase/functions/finalize-office-attribution/index.ts` — strip the re-split logic, keep only re-tag + payout
- `supabase/functions/reconcile-internal-ledger/index.ts` — duplicate detection + office_id correction

No DB schema migration required (existing columns suffice).

