
This is a large scope. I'll break it into 9 phases and ship incrementally, each phase self-contained and typechecked before moving on. Please confirm phase order or reprioritise.

## Phase 1 — Premium Service (per-property subscription)
- New table `premium_subscriptions` (property_id, subscriber_user_id, subscriber_role landlord|tenant, assigned_agent_user_id, starts_at, expires_at, status, yearly_fee, management_enabled).
- Landlord + Tenant "Premium Service" page: list properties, subscribe/renew (yearly), see assigned agent, expiry, management status.
- Agent-side view of premium clients in existing AgentLayout.
- Fee routed through wallet/escrow using existing split framework.

## Phase 2 — Digital Rent Cards polish
- Add "Download PDF" on `DigitalRentCardView` for both landlord + tenant using existing `generateTenancyCardPdf`.
- Backfill: for tenancies without a tenant-copy card row, auto-generate a tenant view record (read-only mirror of landlord copy) so tenants of pre-existing tenancies can see and download.
- Ensure a single source-of-truth query so landlord + tenant see identical live data (already shared component; verify field parity + add realtime subscribe).

## Phase 3 — Property Assessments location + tenant apply
- Extend `property_assessment_applications` with `latitude`, `longitude`, `ghana_post_gps`, `location_source` (map|gps|live), `location_notes`.
- Update `PropertyAssessmentsPage` request form: Google Maps picker + "Use my location" + GPS field (reuse `PropertyLocationPicker`).
- Tenant variant: allow applying for (a) properties currently occupied via tenancy, (b) marketplace properties they intend to rent (property search combobox).

## Phase 4 — Safety Reports: Drug Abuse + richer form
- Add `drug_abuse` to `safetyCategories.ts`.
- Extend `ReportSafetyIssue` form (and `safety_reports` columns if missing): current location/map pin, written directions, nearest landmark, "location unknown" flag, person involved, description, date+time, photo/video upload (multi), anonymous toggle.
- Repeat the same form for tenant/landlord/student/nugs entry points (already share `ReportSafetyIssue`).

## Phase 5 — Platform Escrow (Super Admin) expansion
- Extend existing `PlatformEscrowDashboard` buckets to include: Premium Service, NAFLIS Wallet fees, Rent Management (5%), Maintenance (5%), Agent Payments, Assessments, Registration Fees.
- Enforce `is_super_admin` gate (already in place); keep hidden from all other roles.

## Phase 6 — Become an Agent (parity)
- Public "Become an Agent" landing route + registration form (`agent_applications`), Ghana Card KYC upload, approval workflow for admins, assigned-clients dashboard, "Perform an Action" (act-on-behalf) already scaffolded via `agent_can_act_on` — wire UI end-to-end.

## Phase 7 — Engine Room fee configuration
- New table `platform_fee_configs` (fee_key, label, amount_type flat|percent, amount, billing_frequency, effective_from, status, exemptions jsonb, revenue_destination, reporting_category).
- Seed fees: landlord_registration_yearly, premium_service_per_property, assessment_application, assessment_renewal, student_registration, other_registration, naflis_wallet_monthly, rent_management_pct (5), maintenance_pct (5).
- Super-Admin UI in Engine Room: toggle, amount/percent, frequency, effective date, exemptions, revenue destination.
- Central resolver `getFeeConfig(key)` used by all charge points → single write to receipts + escrow_splits + wallet_entries + cashbook (no duplicates).

## Phase 8 — Automated Cashbook
- New view `v_cashbook_entries` derived from `payment_receipts` + `escrow_splits` + `wallet_entries` (one row per reconciled payment), plus persisted `cashbook_snapshots` for opening/closing balances per period.
- Add "Cashbook" tab inside Escrow & Revenue and inside Receipts (regulator portal).
- Columns: date/time, receipt #, payment ref, description, category, payer, office/channel, method, money in, money out, running balance, reconciliation status, recorded by.
- Filters: date presets + custom range, office, payment type, method, reconciliation.
- Summary: opening, total receipts, total payments/adjustments, closing, reconciled/unreconciled totals.
- Exports: PDF (with report ref #, timestamp, page numbers, watermark, audit trail), Excel, print.
- Invariant enforced in DB: one payment = one ledger row = one receipt = one cashbook row (unique index on payment_reference).

## Phase 9 — Complaints: CAR case numbers + Form 7/33 auto-fill + layout
- New sequence per year: function `generate_car_case_number()` returning `{prefix}/{NNN}/{YYYY}` (prefix configurable in platform_config, default `CAR`), resets Jan 1, unique constraint on `complaints.case_number`.
- Assign on complaint create; propagate to Form 7, Form 33, receipts, documents, notifications.
- Form 7 & 33 renderers: hard-require complainant + respondent full names; refuse to generate if missing (surface actionable error listing what's absent). Auto-pull addresses, phones, property, complaint summary, assigned office, related Form 7 data from complaint record — no manual retyping.
- Only hearing date/time/venue/officer stay editable on Form 33.
- Font/layout: bump body to ~11pt, labels ~10.5pt bold, FORM 33 heading to ~18pt bold; balance vertical spacing so an A4 page fills without excess whitespace or crowding.

---

## Technical notes
- DB grants: every new public table gets `GRANT` block + RLS in the same migration.
- Reuse existing components (`PropertyLocationPicker`, `HeaderAvatar`, `DigitalRentCardView`, `renderForm33`) — no forks.
- Cashbook is derived, not double-written; realtime updates via Supabase channel on the underlying tables.
- Fee resolver is the single write path — remove any hardcoded fee constants in favour of `platform_fee_configs`.

## Suggested order
1 → 4 → 2 → 3 → 9 → 7 → 8 → 5 → 6

Reply "proceed" to start with Phase 1 (Premium Service), or tell me which phase to tackle first / reorder.
