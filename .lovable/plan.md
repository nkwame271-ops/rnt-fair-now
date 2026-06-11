# Agency API v3 — Industry Standards + Paystack Monetization

Building on the existing Agency API console, this plan adds the missing industry-standard features and a full pricing/billing layer payable via Paystack, with a master switch to keep the API free.

---

## Part A — Industry-Standard API Features (currently missing)

### 1. Webhooks (event subscriptions)
Let agencies subscribe to events instead of polling.
- New tables: `api_webhook_endpoints` (url, secret, events[], status, last_delivery_at, failure_count), `api_webhook_deliveries` (endpoint_id, event_type, payload, status_code, response_body, attempt, next_retry_at).
- Events emitted: `landlord.created`, `tenant.registered`, `tenancy.activated`, `tenancy.terminated`, `complaint.filed`, `complaint.status_changed`, `property.listed`, `payment.reconciled`.
- HMAC-SHA256 signature header (`X-RentControl-Signature`) using the per-endpoint secret. Standard `t=` + `v1=` format (Stripe-compatible) so devs can reuse libraries.
- Retry: exponential backoff (1m, 5m, 30m, 2h, 12h), max 6 attempts, then mark `disabled` and email the agency.
- Edge function: `agency-webhook-dispatcher` invoked by DB triggers via `pg_net`.
- Admin tab "Webhooks": view endpoints per key, force re-deliver, view delivery log.

### 2. API Versioning
- Header `X-API-Version: 2026-06-11` (date-based, Stripe-style) OR URL path `/v1/...`. Choose URL path for simplicity.
- All current endpoints move under `/v1/`. `/` returns a version index.
- `api_keys.pinned_version` column so breaking changes don't surprise integrators.

### 3. Standard pagination, filtering, sorting
- All list endpoints accept `?page=&page_size=` (max 100), `?sort=field:asc`, basic `?filter[field]=value`.
- Response envelope: `{ data: [...], meta: { page, page_size, total, total_pages }, links: { next, prev } }`.

### 4. Idempotency keys
- `Idempotency-Key` header on any future write endpoint; stored in `api_idempotency_keys` (key, request_hash, response_body, expires_at — 24h).

### 5. Standardized errors
- RFC 7807 problem+json: `{ type, title, status, detail, request_id }`.
- Every response carries `X-Request-Id` (uuid) that ties back to `api_request_log` for support.

### 6. Rate limit response headers
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429. Already enforced server-side; just expose them.

### 7. CORS + security headers
- Strict CORS allowlist per key (`allowed_origins` column).
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` on all responses.

### 8. Health + metadata endpoints
- `GET /v1/health` → `{ status, time, version }` (public).
- `GET /v1/me` → returns key metadata (scopes, plan, quotas remaining, expiry). Useful for integrators to self-diagnose.

### 9. OpenAPI 3.1 spec
- Serve `/v1/openapi.json` generated from a single source of truth. Embed Swagger UI at `/developers/api/reference`.
- Lets agencies generate client SDKs automatically.

### 10. Usage exports + alerts
- Agency-facing CSV export of their own usage (when we add an agency portal later — out of scope here, but schema supports it).
- Admin alerts when an agency hits 80% / 100% of monthly quota.

### 11. Sandbox / Test mode
- `environment = 'sandbox' | 'live'` already exists. Sandbox keys hit the same endpoints but return synthetic, deterministic fixtures and are exempt from billing.

### 12. Key rotation grace period
- When rotating, keep old hash valid for 24h (configurable) under `api_keys.previous_key_hash` + `previous_key_expires_at`. Log calls on the old key as `rotation_grace` so agencies have time to redeploy.

### 13. Data Sharing Agreement (DSA) versioning
- `api_dsa_versions` table; `api_keys.dsa_version_accepted`. Force re-acceptance when DSA changes.

### 14. Audit + compliance exports
- Admin one-click export of all calls a given agency made against a given citizen (Ghana Card or phone) — required for DPA subject-access requests.

---

## Part B — Paystack Pricing & Billing

### 1. Master switch
- `platform_config` row: `agency_api_billing_enabled` (bool, default `false`).
- When `false`: all keys are free, no metering charges, "Free Mode" banner shown in admin + dev docs. Toggle is one click in admin.

### 2. Plans
- New table `api_pricing_plans`:
  - `name`, `slug`, `description`
  - `price_ghs` (monthly)
  - `included_calls` (per month)
  - `overage_price_ghs_per_1k` (nullable — if null, hard cap at included_calls)
  - `rate_limit_per_minute`
  - `allowed_scopes[]`
  - `webhook_endpoints_max`
  - `environment_access` (`sandbox` / `live` / `both`)
  - `is_active`, `is_public`, `sort_order`
- Seed plans: **Free** (1,000 calls/mo, sandbox only), **Starter** (GHS 500/mo, 50k calls, live), **Growth** (GHS 2,500/mo, 500k calls), **Enterprise** (custom, GHS 0 placeholder, manually provisioned).
- Admin tab "Plans": CRUD with live preview of what agencies see in docs.

### 3. Subscriptions
- `api_subscriptions` table: `api_key_id`, `plan_id`, `status` (`trialing`/`active`/`past_due`/`canceled`), `current_period_start/end`, `paystack_subscription_code`, `paystack_customer_code`, `cancel_at_period_end`.
- One active subscription per key.

### 4. Paystack integration
- New edge function `agency-api-billing`:
  - `POST /create-subscription` → creates Paystack customer + plan + subscription, returns authorization URL.
  - `POST /cancel-subscription`
  - `POST /change-plan` (proration handled by Paystack).
  - `POST /webhook` (Paystack → us): handles `subscription.create`, `subscription.disable`, `invoice.create`, `invoice.payment_failed`, `charge.success`. Verifies `x-paystack-signature` HMAC.
- On payment success → mark subscription `active`, reset monthly call counter, enable live key.
- On payment failure (3 retries by Paystack) → mark `past_due`, downgrade key to sandbox-only after grace period (7 days).

### 5. Metering & enforcement
- New table `api_usage_counters` (api_key_id, period_start, period_end, calls_count, overage_calls, overage_amount_ghs).
- `agency-api` increments the counter atomically per call.
- When `calls_count >= included_calls`:
  - If overage allowed → keep serving, accrue `overage_amount_ghs`.
  - Else → return 429 with `error: quota_exceeded` and a link to upgrade.
- End of billing period: edge function `agency-api-bill-overages` charges overage via Paystack `transaction/charge_authorization` using the saved authorization code, writes a receipt.

### 6. Invoices & receipts
- Reuse existing `payment_receipts` infra. New `api_invoices` table records line items (base subscription, overage, taxes if any).
- Admin "Billing" tab: list invoices per agency, mark paid, refund, download PDF.

### 7. Public pricing page
- Add `/developers/api/pricing` route — public, marketing-style, with the four plan cards, FAQ, and "Request Enterprise" form.
- Hidden when `agency_api_billing_enabled = false`; instead shows a "Currently free during beta" notice.

### 8. Admin pricing console
- Extend `AgencyApiKeys.tsx` with two new tabs:
  - **Plans** — CRUD on `api_pricing_plans`, plus the master billing toggle.
  - **Billing** — per-key subscription status, current period usage bar, manual override (comp a key for free, force-cancel, refund last invoice), revenue chart (MRR, churn).

### 9. Per-key billing overrides
- `api_keys.billing_override` (`free` / `custom_price` / `null`) lets ops give a partner a free or negotiated rate without touching the plan catalog. Always wins over the plan price.

---

## Technical Details

### New migrations
1. Webhooks: `api_webhook_endpoints`, `api_webhook_deliveries`, triggers + `pg_net` queue.
2. API hardening: `api_idempotency_keys`, `api_dsa_versions`, add `pinned_version`/`allowed_origins`/`previous_key_hash`/`previous_key_expires_at` to `api_keys`.
3. Billing: `api_pricing_plans`, `api_subscriptions`, `api_usage_counters`, `api_invoices`. Add `agency_api_billing_enabled` to `platform_config`.
4. All tables: standard `GRANT`s, RLS (admin write, public read for `api_pricing_plans` where `is_public`), `is_main_admin()` gates.

### Edge functions
- `agency-api` (refactor): move to `/v1/...`, add pagination, idempotency, error envelope, rate-limit headers, OpenAPI handler, metering hook, `/me`, `/health`.
- `agency-webhook-dispatcher` (new): consumes webhook event queue, signs + delivers + retries.
- `agency-api-billing` (new): Paystack subscription lifecycle + webhook receiver.
- `agency-api-bill-overages` (new, scheduled monthly): charges overages on saved authorizations.

### Frontend
- `src/pages/regulator/AgencyApiKeys.tsx`: add `Webhooks`, `Plans`, `Billing` tabs.
- `src/pages/regulator/agency-api/WebhooksTab.tsx`, `PlansTab.tsx`, `BillingTab.tsx`, `BillingToggle.tsx`.
- `src/pages/developers/ApiPricing.tsx` (new public route).
- `src/components/agency-api/ApiDocsContent.tsx`: add sections for Webhooks, Versioning, Pagination, Errors, Idempotency, Pricing link.
- Embed Swagger UI at `/developers/api/reference` (via `swagger-ui-react`).

### Secrets required
- `PAYSTACK_SECRET_KEY` (already in project? to confirm — will request via `add_secret` if missing).
- `PAYSTACK_WEBHOOK_SECRET` (same value as secret key for Paystack — HMAC uses the secret key).

### Out of scope (future)
- Self-service agency portal (agencies log in to manage their own keys/subscriptions). For now everything is admin-mediated; agencies email/contact to request keys, admin issues + assigns plan, sends Paystack checkout link.
- OAuth2 client credentials flow.
- Per-endpoint pricing (only per-call metering for now).
- Multi-currency (GHS only).

---

## Questions before building
1. **Billing toggle default**: start with billing **OFF** (free beta) so existing partners keep working, then flip on when ready? (recommended)
2. **Free plan**: should the Free plan allow **live** data (with masking + low quota), or **sandbox only**? Sandbox-only is safer.
3. **Overage behavior default**: hard cap at quota (block with 429) or soft cap (keep serving + bill)? Recommend hard cap on Starter, soft on Growth+.
4. **Enterprise pricing**: show "Contact sales" CTA only, or allow admin to set a custom GHS price visible to that one key?