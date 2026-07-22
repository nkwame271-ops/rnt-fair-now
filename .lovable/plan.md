
## Admin Portal

### A. Engine Room
- Audit every recently added tenant/landlord feature (property assessment, premium service, wallet top-up, wallet withdrawal, digital rent card, safety report, agent program, rent management deduction) and ensure each has a row in `feature_flags` with: `enabled` toggle, `fee_type`, `amount/percentage`, `billing_frequency`, `expiry_days`, `renewal_days`, `grace_period_days`, `payment_destination`, and `revenue_split_json`. Add any missing rows via migration.
- **Advanced Settings reset bug:** `FeatureAdvancedDialog` re-hydrates from the `initial` prop, but the parent list re-uses a stale in-memory copy after save so reopening shows the old values. Fix by (a) refetching the affected flag after `onSaved` in the Engine Room list and passing fresh `initial` in, and (b) letting the dialog return the saved payload so the parent updates local state optimistically. Also stop the dialog's `useEffect` from resetting local state on every parent re-render — key it strictly to `open` transitions.

### B. Cashbook (rebuild on Escrow Ledger)
- Change data source from `cashbook_entries` aggregates to `escrow_transactions` (+ `escrow_splits`/`payout_transfers` for outflows). Cashbook becomes a read-model over the ledger.
- Inherit RLS from `escrow_transactions`: Super Admin sees all; Regulator/Office admins see only their scoped rows (via existing `is_main_admin()` / office scope helpers). Totals are computed from the visible rowset only.
- Summary cards: **Opening Balance, Money In, Money Out, Current Escrow Balance, Reconciled Amount**, with the invariant `Opening + In − Out = Current`. Opening = balance at range start; Current = Opening + In − Out for the range.
- Table columns: Date, Receipt/Reference, Description, Money In, Money Out, Running Balance (computed via SQL window function `SUM(in − out) OVER (ORDER BY date, id)` seeded with Opening Balance).
- Money Out sources: payouts to Paystack, wallet withdrawals, refunds, reversals, manual disbursements, automated settlements. If none, Money Out = GHS 0.00.
- Deprecate the `post_receipt_to_cashbook` trigger path for display (keep the table for legacy but stop reading from it in the UI).

### C. Agent Portal redirect loop
- `RoleSelect` sends approved agents back to `/` because `useAuth` role resolution races the `agent_staff` lookup. Fix `useAuth` to include agent role detection (query `agent_staff` where `user_id = auth.uid()` and `status='active'`) and expose an `isAgent` flag. Route agents to `/agent/dashboard` from `RoleSelect` and `ProtectedRoute` fallbacks. Also ensure `AgentRoute` waits for auth hydration before redirecting.

### D. Complaints — Forms 7/33 and case numbers
- **Form 7:** rescale to fit A4 single page — labels 16pt, body 14pt, tighter but balanced section spacing, reduced top/side margins. Verify with a print preview render.
- **Form 33:** implement full generator using the same style as Form 7. Both forms pull from the same complaint record and must render the same `case_number`.
- **Case numbering:** confirm `car_case_counters` assigns `<PREFIX> NNN/YYYY` once at complaint creation and stores it on `complaints.case_number`. Every downstream artifact (Form 7, Form 33, receipts, notifications, documents) reads that field — never regenerates. Keep `platform_config.car_case_prefix` editable in Admin.

## Landlord Portal

### A. Digital Rent Cards
- Tenant name shows "-" when `rent_cards.tenant_user_id` is null. Root cause: some rent cards were created before the backfill and new issuance paths still don't set `tenant_user_id`/`tenancy_id`.
- Fix issuance code (`issue-rent-card` / `ManageRentCards` flow) to require and store `tenancy_id` and derive `tenant_user_id`, `landlord_user_id`, `unit_id` at creation. Add a DB check/trigger to reject inserts with null tenancy linkage going forward.
- Update `DigitalRentCardView` to join through `tenancies → tenants/landlords/units/properties/profiles` so name/unit/property are always resolved from the live tenancy, not denormalized strings.
- Run one more backfill pass for any remaining unlinked rent cards.

### B. Property Assessment checkout
- `assessment-checkout` returns non-2xx. Inspect edge function logs to find the exact cause (likely missing `assessment_fee` flag row or missing `pending_assessment_drafts` insert permissions). Fix the function and add `assessment_fee` under **Platform Fees** in Engine Room with configurable amount/frequency.

### C. Premium Service
- Fix `premium-checkout` non-2xx (same investigation pattern — logs + fee flag). Ensure `premium_service_fee` is Engine-Room configurable.
- **Premium dashboard for landlord** shows assigned agent card: avatar, agent ID, phone, email, service status, subscription status, expiry date, and the property currently under management. Actions: Call, SMS, Request Service, Revoke Access, Request Change of Agent.
- Service requests write to `management_task_assignments` (or a new `premium_service_requests` table if needed) and surface in the agent's dashboard, using existing landlord workflows for execution.
- Enforce agent restrictions: RLS + UI guard blocking agents from mutating `landlord_payment_settings`, `wallet_payout_accounts`, passwords, transaction PINs, or verified contact fields.

### D. NAFLIS Wallet
- **Add Money non-2xx:** check `wallet-topup` logs, confirm `wallet_topup` feature flag enabled, confirm Paystack init call succeeds, fix root cause (usually missing flag row or bad `amount` shape).
- **Payout Accounts empty:** `wallet-list-banks` returns nothing. Verify the function is calling Paystack `/bank?country=ghana` with the live secret and returns both bank + mobile money entries. Fix response shape the UI expects (`{ banks: [], momo: [] }`).
- Ensure withdrawal flow reuses stored account or accepts a fresh one.

## Main Page
- Hide the Student role tile on `/` (`RoleSelect` / landing role grid). Keep the route reachable via NUGS/institution flows but remove the self-registration entry point.

## Technical notes

- **Files (frontend):** `src/components/FeatureAdvancedDialog.tsx`, Engine Room list page, `src/pages/regulator/RegulatorCashbook.tsx`, `src/hooks/useAuth.tsx`, `src/pages/RoleSelect.tsx`, `src/components/AgentRoute.tsx`, `src/lib/pdf/form7.ts`, `src/lib/pdf/form33.ts`, `src/components/rentcards/DigitalRentCardView.tsx`, `src/pages/shared/PropertyAssessmentsPage.tsx`, `src/pages/PremiumServiceLanding.tsx` + landlord premium dashboard, `src/pages/shared/Wallet.tsx`, landing role grid.
- **Files (edge):** `assessment-checkout`, `premium-checkout`, `wallet-topup`, `wallet-list-banks`, `wallet-add-payout-account`, `wallet-withdraw`, `issue-rent-card` (or equivalent), plus `_shared/finalize-payment.ts` where relevant.
- **DB migrations:**
  - Add/normalize `feature_flags` rows for all new payment features (including `assessment_fee`, `premium_service_fee`).
  - Backfill `rent_cards.tenant_user_id` / `tenancy_id`; add NOT NULL + FK once clean.
  - Optional `premium_service_requests` table (or reuse `management_task_assignments`) with RLS + GRANTs.
  - Cashbook view: a SQL view `v_cashbook_entries` over `escrow_transactions` (+ outflow tables) with running balance, respecting the same RLS as the base tables. UI queries the view.
- **Verification:** after each fix, hit the affected flow in the preview and confirm the network response, then screenshot the UI state (Cashbook totals reconcile, agent dashboard reachable, Form 7 = 1 page, Form 33 renders with matching case number, rent card shows tenant name, all three checkouts return 200 and open Paystack).

## Open question
The "Advanced Settings reset" complaint — before I ship the fix, confirm whether the values in the DB are correct after save (i.e. it's purely a UI re-hydration bug) or whether the save itself is silently dropping fields. I'll check with a `read_query` on `feature_flags` right after your next test save to be sure.
