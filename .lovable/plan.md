
# Developer Portal for the Agency API

A self-service portal where third parties sign up, get a sandbox key instantly, browse endpoints, test calls, and request live access (regulator approval required). Reuses existing auth and the existing `api_keys` / `api_pricing_plans` / `api_request_log` / `api_webhook_endpoints` tables — no parallel system.

## 1. Public marketing surface (no login)

- **Homepage** — add a small "For developers" link in the footer and a "Build with our API" CTA card on the homepage that goes to `/developers`.
- **`/developers`** — new landing page: what the API does, who it's for, four product pillars (Landlord, Tenant, Property, Complaints), "Free during beta" banner, two buttons: **Get an API key** (→ signup) and **Read the docs** (→ existing `/developers/api`).
- Existing `/developers/api` (docs) and `/developers/api/pricing` stay; they get a top nav linking back to the landing + login.

## 2. Account model

- **Same auth, new `developer` app_role.** Signup at `/developers/signup` creates a Supabase user, a `profiles` row, and assigns the `developer` role.
- A new `developer_organizations` table represents the company behind the key (one user can belong to one org for v1).
- An `organization_id` column is added to `api_keys` so a key belongs to an org (in addition to the existing `agency_name`). Regulator-issued keys keep working unchanged (nullable column).
- Membership table `developer_org_members(org_id, user_id, role)` so we can add teammates later. v1 only "owner".

## 3. Signup → sandbox key flow (auto)

1. User signs up at `/developers/signup` with name, email, password, organization name, intended use case.
2. Email verification via existing Lovable auth.
3. On first login, portal auto-provisions:
   - one `developer_organizations` row,
   - one **sandbox** `api_keys` row (`environment = 'sandbox'`, plan = `free`, scopes = all `:read` scopes restricted to sandbox data),
   - the plaintext key is shown **once** in a modal with copy button + "I've stored it" confirmation.
4. From that point the portal shows only the masked prefix + last-rotated date.

## 4. Live key flow (regulator approval)

- New table `api_access_requests` captures: org, requested scopes, agency type, contact, intended volume, DSA acceptance.
- Submitting the request creates a row with status `pending`; it shows up in the existing regulator console (`AgencyApiKeys.tsx`) under a new **Requests** tab.
- Regulator can **approve** (issues a `rcg_live_…` key against the org, sets scopes + plan, emails the developer that the key is ready), **request changes**, or **deny**.
- Developer dashboard shows the request status in real time.

## 5. Developer dashboard (`/developers/dashboard`)

Sidebar layout, all scoped to the signed-in org:

- **Overview** — sandbox vs live status, calls today / this month, error rate, p95 latency. Quick links.
- **API Keys** — list of keys (env, plan, status, last used, rotation grace countdown). Actions: copy prefix, rotate (shows new key once), revoke. Big primary button **Request live access** if no live key exists.
- **Sandbox console** — interactive "Try it" panel: pick endpoint, fill filters (form generated from the same catalogue used in docs), pick a key, hit Send. Calls go through the existing `agency-api` edge function with the user's sandbox key and renders the JSON + headers (`X-Request-Id`, rate-limit). No new backend code; this is just a UI on top of `fetch`.
- **Webhooks** — add endpoint URL, choose events, view recent deliveries (reads `api_webhook_endpoints` + `api_webhook_deliveries`), rotate signing secret.
- **Usage** — 30-day chart of requests, status-code breakdown, top endpoints (reads `api_request_log` filtered by org's keys).
- **Billing** — plan card with current plan, included calls, used calls, next renewal. While billing master switch is OFF, shows "Free during beta — no payment required" banner; plan upgrade buttons are visible but disabled with tooltip "Available when billing opens". When the switch flips on, the existing `agency-api-billing` checkout opens.
- **Docs** — embeds the existing `ApiDocsContent` component (no duplication).
- **Settings** — org name, contact email, DSA status, members (placeholder), delete org.

## 6. Regulator side (small additions to existing console)

- New **Requests** tab in `AgencyApiKeys.tsx` listing pending `api_access_requests` with one-click Approve / Deny.
- Existing Keys tab gains an "Org" column when a key has `organization_id`.

## 7. Security & guardrails

- New RLS:
  - `developer_organizations`, `developer_org_members`, `api_access_requests` → users see only rows for orgs they belong to; regulators see all.
  - `api_keys` → developers can SELECT only keys whose `organization_id` is theirs (no `api_key_hash` column exposed via a view: `api_keys_developer_view` strips the hash).
  - `api_request_log`, `api_webhook_*` → filtered by org's `api_keys.id`.
- The plaintext key is **never** stored or returned again after issuance — same contract as today.
- Sandbox keys are hard-capped: can only call sandbox-flagged data sources, max 1,000 calls/month (already enforced by the Free plan).
- New edge function `developer-api-self-service` handles: provisioning sandbox key on first login, rotating own key, revoking own key, submitting access requests. Server-side validation that `auth.uid()` owns the target key/org.
- Audit: every self-service action writes to `admin_audit_log` with actor + action + target.

## 8. Notifications

- Email on: signup verification (existing), sandbox key issued, access request submitted, access request approved/denied, key rotated, key revoked, monthly usage at 80% and 100%.
- Regulator email on new access request.
- All via existing `send-transactional-email`.

## 9. Routes added

```text
/developers                       public landing
/developers/signup                public signup form
/developers/login                 public login (reuses /auth with redirect)
/developers/dashboard             gated, role=developer
/developers/dashboard/keys
/developers/dashboard/sandbox
/developers/dashboard/webhooks
/developers/dashboard/usage
/developers/dashboard/billing
/developers/dashboard/docs
/developers/dashboard/settings
/developers/request-access        gated form, creates api_access_requests row
```

## 10. Technical details

**Migrations**

- `developer_organizations(id, name, contact_email, contact_phone, dsa_version_accepted, dsa_signed_at, owner_user_id, created_at, updated_at)` + GRANT + RLS.
- `developer_org_members(org_id, user_id, role enum 'owner', created_at)` + GRANT + RLS, unique (org_id, user_id).
- `api_access_requests(id, org_id, requested_environment, requested_scopes text[], intended_volume_monthly, agency_type, justification, status enum pending|approved|denied|changes_requested, reviewed_by, reviewed_at, review_notes, issued_api_key_id, created_at, updated_at)` + GRANT + RLS.
- `ALTER TABLE api_keys ADD COLUMN organization_id uuid REFERENCES developer_organizations(id)`.
- Add `'developer'` to the `app_role` enum.
- View `api_keys_developer_view` exposing safe columns (no `api_key_hash`, no `previous_key_hash`).
- RPC `developer_provision_sandbox_key(org_id)` (SECURITY DEFINER) returning the plaintext key once.

**Frontend**

- `src/pages/developers/Landing.tsx`, `Signup.tsx`, `Dashboard.tsx` shell with nested routes, plus one file per tab in `src/pages/developers/dashboard/`.
- Shared hook `useDeveloperOrg()` returns the signed-in user's org + keys.
- Sandbox console uses `BASE_URL = https://${VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/agency-api` and calls it directly from the browser with the user's chosen sandbox key (sandbox CORS already enabled).
- Route guard in `App.tsx`: `<RequireRole role="developer">`.

**Edge functions**

- `developer-api-self-service` — single function, action-based body: `issue_sandbox_key`, `rotate_key`, `revoke_key`, `submit_access_request`, `add_webhook`, `remove_webhook`, `rotate_webhook_secret`.
- `agency-api-admin` already handles regulator-side issue/approve — extend it with an `approve_access_request` action that creates a live key on the requesting org.

## 11. Out of scope for v1

- Multi-member orgs (schema supports it; UI is single-owner only).
- OAuth client-credentials flow (sticks with `X-API-Key`).
- Paid plan checkout (UI present, gated by master billing switch which stays OFF).
- Self-service DSA signing flow (regulator still signs off; developer just accepts terms).

## 12. Acceptance criteria

- A new visitor can land on `/developers`, sign up, verify email, log in, and have a working sandbox `rcg_test_…` key inside 2 minutes without regulator involvement.
- The sandbox console can successfully call `landlords/list` and render the JSON response and rate-limit headers.
- Submitting a live-access request creates a row visible to the regulator; approving it issues a live key visible (masked) in the developer's dashboard and emails them.
- A developer cannot see another org's keys, usage, webhooks, or requests (verified by RLS).
- The existing regulator console keeps working unchanged for legacy regulator-issued keys.
