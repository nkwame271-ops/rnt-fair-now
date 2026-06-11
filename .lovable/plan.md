# External Agency API Access Program

Build a complete admin-controlled API gateway so third-party agencies can read **Landlords, Tenants, Properties, and Complaints** with scoped, revocable tokens — and we can see in real time what they're doing.

The existing `agency-api` edge function + `api_keys` table give us the foundation; this plan upgrades it to a proper product surface.

---

## 1. Data model (migration)

Extend the API system to track issuance, usage, and rate limits.

- **`api_keys`** — add columns:
  - `key_prefix text` (first 8 chars, shown in UI so admins can identify keys without seeing the secret)
  - `agency_contact_email text`, `agency_contact_phone text`
  - `environment text` (`sandbox` | `production`)
  - `rate_limit_per_minute int default 60`
  - `allowed_ip_cidrs text[]` (optional IP allowlist)
  - `expires_at timestamptz`
  - `revoked_at timestamptz`, `revoked_by uuid`, `revoke_reason text`
  - `last_used_ip inet`

- **`api_request_log`** (new) — one row per API call for the real-time monitor:
  - `id`, `api_key_id`, `agency_name`, `endpoint`, `scope_used`, `method`,
    `status_code`, `response_ms`, `ip`, `user_agent`,
    `request_params jsonb`, `error_message`, `created_at`
  - Indexed on `(api_key_id, created_at desc)` and `(created_at desc)`.
  - RLS: only `is_main_admin()` reads; service_role writes.

- **`api_scopes`** (new lookup) — admin-editable catalogue of scopes:
  - `scope_key`, `label`, `description`, `category` (landlord/tenant/property/complaint/stats/identity/tax), `is_active`.
  - Seeded with the seven scopes already in `SCOPE_MAP`.

- Add `ALTER PUBLICATION supabase_realtime ADD TABLE public.api_request_log` so the admin dashboard can stream calls live.

All tables get the required `GRANT` block + RLS policies gated on `is_main_admin()`.

## 2. Edge functions

- **`agency-api`** (existing — extend):
  - Look up key by `key_prefix` + verify hash (avoids full-table scan).
  - Reject if `revoked_at`, `expires_at < now()`, IP outside `allowed_ip_cidrs`, or rate limit exceeded (sliding window in `api_request_log`).
  - On every request, insert into `api_request_log` with timing and status. Update `last_used_at` / `last_used_ip`.
  - Add endpoints requested: `landlords/list`, `landlords/detail`, `tenants/list`, `tenants/detail`, `properties/list`, `properties/detail`, `complaints/list`, `complaints/detail` — all **read-only**, paginated, no PII beyond what the scope allows (Ghana Card numbers always masked unless `identity:read` scope is granted).

- **`agency-api-admin`** (new, JWT-verified, `is_main_admin()` gated):
  - `POST /issue` — generates a new key (`rcg_live_…` / `rcg_test_…`), returns plaintext **once**, stores hash + prefix.
  - `POST /revoke`, `POST /rotate`, `POST /update-scopes`, `POST /update-rate-limit`.
  - All actions write to `admin_audit_log`.

## 3. Admin panel — "Agency API Console"

Replace/expand `src/pages/regulator/AgencyApiKeys.tsx` into a tabbed console at `/regulator/agency-api` (sidebar item already exists as "Agency APIs"). Tabs:

1. **Keys** — table of agencies: name, prefix (`rcg_live_a1b2…`), environment, scopes (chips), status, last used, requests today. Actions: Issue, Rotate, Revoke, Edit scopes/rate-limit/IP allowlist/expiry. Issue dialog reveals the plaintext key once with copy + download buttons and a "I've stored this" confirmation.
2. **Live Activity** — real-time feed (Supabase Realtime subscription on `api_request_log`) showing every call as it happens: timestamp, agency, endpoint, status pill, latency, IP. Filter by agency/endpoint/status. Pause/resume.
3. **Usage Analytics** — charts: requests per agency (7/30 days), top endpoints, error rate, p95 latency, rate-limit hits. Powered by aggregate queries on `api_request_log`.
4. **Scopes** — manage the `api_scopes` catalogue (label, description, active).
5. **Documentation** — renders the same docs we expose publicly (see §4), so admins can preview what agencies see.

## 4. Public developer docs portal

New public route `/developers/api` (no auth required) rendered from MDX-style React content:

- Overview, base URL, auth header (`X-API-Key`), error format, rate limits, environments.
- Scope reference (auto-rendered from `api_scopes`).
- Endpoint reference for Landlord / Tenant / Property / Complaint with request/response examples and a "Try it" curl snippet.
- Changelog + status.
- Linked from the main site footer; SEO meta + JSON-LD.

## 5. Security & compliance

- Plaintext keys never stored — only SHA-256 hash + prefix.
- Service-role key never exposed; admin endpoints require `is_main_admin()`.
- All read endpoints respect Ghana data minimisation: Ghana Card numbers, phone numbers, and exact GPS are **masked** by default; full values only with the matching elevated scope and a signed data-sharing agreement flag on `api_keys.dsa_signed_at`.
- IP allowlist + per-key rate limit + global circuit breaker.
- Every admin action audited in `admin_audit_log`.

## 6. Files touched

```text
supabase/migrations/<new>__agency_api_v2.sql        (schema + RLS + grants + realtime)
supabase/functions/agency-api/index.ts              (extend + logging + rate limit + new endpoints)
supabase/functions/agency-api-admin/index.ts        (new)
src/pages/regulator/AgencyApiKeys.tsx               (refactor into tabbed console)
src/pages/regulator/agency-api/KeysTab.tsx          (new)
src/pages/regulator/agency-api/LiveActivityTab.tsx  (new — realtime feed)
src/pages/regulator/agency-api/UsageAnalyticsTab.tsx(new)
src/pages/regulator/agency-api/ScopesTab.tsx        (new)
src/pages/regulator/agency-api/DocsTab.tsx          (new)
src/pages/developers/ApiDocs.tsx                    (new public docs)
src/App.tsx                                         (route registration)
src/components/RegulatorLayout.tsx                  (rename nav label if needed)
```

## 7. Out of scope (ask before adding)

- Write/mutation endpoints (current ask is read-only).
- OAuth2 / per-end-user delegation (we're using static agency tokens).
- Billing / metered pricing for API calls.

---

**Confirm and I'll switch to build mode and implement in this order:** migration → edge functions → admin console → public docs.
