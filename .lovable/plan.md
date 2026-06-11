
# Developer Portal — Approvals, Pending UX, and Proper Documentation

Builds on the existing developer portal. Keeps the agreed model: **sandbox auto-issued, live key requires admin approval**. Adds clear pending-state messaging, hardens the admin-only approval surface, and ships a real public documentation site (not just an endpoint dump).

---

## 1. Live-access approval flow — clearer messaging

### What the developer sees
- After submitting `/developers/request-access` they're redirected to a new status page **`/developers/dashboard/request-status`** that shows:
  - A big "Your request is under review" card with submitted-at timestamp, requested scopes, contact email.
  - Status pill: `Pending review` / `Changes requested` / `Approved` / `Denied`.
  - Reviewer notes (when present).
  - "What happens next" checklist: 1) Admin reviews (1–3 business days), 2) You receive an email, 3) Your live key appears in the Keys tab.
  - Email + in-app notification when status changes (uses existing `notifications` table + `send-transactional-email`).
- The **Keys tab** gets a yellow banner above the "Request live access" CTA when a pending request exists: *"Live access request submitted on … — awaiting admin review."*
- The **Overview tab** surfaces the same status card.

### Admin side
- Only users with `regulator` role (already enforced via RLS + `is_main_admin()`) can see and act on `api_access_requests`.
- The existing `src/pages/regulator/ApiAccessRequests.tsx` gets:
  - A required **review notes** field when denying / requesting changes (currently optional).
  - On **Approve**: a confirm dialog explaining "this only records the decision — you still need to issue the live key from Agency API → Keys".
  - A new **"Issue live key now"** shortcut button on approved rows that deep-links to `/regulator/agency-api?issueForOrg=<org_id>&scopes=…` so the regulator doesn't have to retype org/scopes.
- `AgencyApiKeys.tsx` "Issue key" dialog reads those query params and pre-fills.
- Every decision writes to `admin_audit_log` (actor, action, target org, target request, notes).

### Pending-account UX (sandbox case)
Sandbox is still auto-issued on first login (no admin gate) — that's the agreed model. But signup confirmation now sets clear expectations:
- Signup success screen: *"Account created. Your sandbox key is ready. To call production data, request live access — an admin will review within 1–3 business days."*
- Verification email reuses the same copy.

---

## 2. Master admin controls (admin-only)

In `/regulator/agency-api`, add an **Access Control** section visible only to `is_main_admin()`:
- Toggle: **"Pause new developer signups"** — when on, `/developers/signup` shows a "Signups temporarily closed" page and the public landing CTA is disabled.
- Toggle: **"Auto-approve sandbox keys"** (default ON) — when off, even sandbox keys require admin approval (future-proof for tightening).
- Toggle: **"Require DSA re-acceptance"** — flips a flag on `developer_organizations` so all orgs must re-accept on next login.

Stored in `platform_config` (existing table). No new schema needed.

---

## 3. Public documentation site — proper, step-by-step

Replaces the bare `/developers/api` page with a real docs site at **`/developers/docs/*`** (legacy URL keeps working via redirect).

### Structure (left sidebar, mkdocs-style)

```text
Getting started
  Introduction                /developers/docs
  Quickstart (5 minutes)      /developers/docs/quickstart
  Authentication              /developers/docs/auth
  Environments (sandbox/live) /developers/docs/environments
  Rate limits & quotas        /developers/docs/rate-limits
  Errors & status codes       /developers/docs/errors

Tutorials
  Verify a landlord           /developers/docs/tutorials/verify-landlord
  Check a tenancy             /developers/docs/tutorials/check-tenancy
  Look up a property          /developers/docs/tutorials/lookup-property
  Receive webhooks            /developers/docs/tutorials/webhooks
  Handle pagination           /developers/docs/tutorials/pagination
  Retries & idempotency       /developers/docs/tutorials/retries

Reference
  Landlords endpoints         /developers/docs/reference/landlords
  Tenants endpoints           /developers/docs/reference/tenants
  Properties endpoints        /developers/docs/reference/properties
  Complaints endpoints        /developers/docs/reference/complaints
  Webhook events              /developers/docs/reference/webhooks

Going live
  Request live access         /developers/docs/go-live
  Data Sharing Agreement      /developers/docs/dsa
  Pricing & billing           /developers/docs/pricing
  Support & SLA               /developers/docs/support
```

### Every page includes
- A plain-English explainer ("What this does, who uses it, when to use it").
- A copy-button **curl** snippet AND a **JavaScript (fetch)** snippet, both with realistic Ghana sample data (e.g. `0244111222` landlord lookup).
- A live "Open in sandbox console" button that pre-fills the dashboard Sandbox tab via querystring (`?endpoint=landlords/list&params=…`).
- Response example with field-by-field table.
- "Common mistakes" callout.

### Quickstart specifically (the "dumbed-down" one the user asked for)
Five numbered steps, each with a screenshot placeholder + copy-paste block:
1. **Create your developer account** — `/developers/signup`.
2. **Copy your sandbox key** — shown once after first login; format `rcg_test_…`.
3. **Make your first call** — single curl command hitting `GET /landlords/lookup?phone=0244111222`.
4. **Read the response** — annotated JSON.
5. **Request live access when ready** — link to `/developers/request-access`.

### Implementation
- New folder `src/pages/developers/docs/` with one file per page above (small MDX-style React components — no MDX runtime, just JSX with shared `<DocLayout>`, `<CodeBlock>`, `<EndpointTable>`, `<Callout>` primitives).
- Shared `src/components/developers/docs/` for those primitives + a sticky sidebar nav and search-as-you-type filter.
- The existing `ApiDocsContent` component becomes the body of the four `reference/*` pages (chunked by domain instead of one giant page).
- Top navigation on every docs page: Quickstart · Tutorials · Reference · Pricing · Dashboard.
- SEO: `<Helmet>` with per-page title/description, canonical URLs, JSON-LD `TechArticle`, sitemap entries added to `public/sitemap.xml`.
- Footer link "For developers → Documentation" added to homepage.

---

## 4. Data / backend changes

Only one tiny migration — most plumbing already exists:

- `api_access_requests`: add `notified_at timestamptz` (so we don't send duplicate decision emails).
- `developer_organizations`: add `signup_paused_acknowledged_at` (unused for v1; reserved for the admin pause toggle).
- New edge function action in `developer-api-self-service`: `cancel_access_request` so a developer can withdraw a pending request.
- New scheduled trigger in `agency-api-admin`: when a request flips to `approved` / `denied` / `changes_requested`, queue an email via `send-transactional-email` and a row in `notifications`.

No changes to RLS beyond the existing policies — `regulator` role already covers admin approval.

---

## 5. Acceptance criteria

- A signed-up developer who submits a live-access request is redirected to a status page that clearly says "under review" and updates in real time when admin acts.
- Admin (regulator role) can approve / deny / request changes; non-admins get a 403 from RLS and never see the queue.
- Approving a request emails the developer and surfaces a one-click "Issue live key" shortcut for the admin.
- `/developers/docs/quickstart` walks a non-technical reader from signup to first successful API call in under 5 minutes using copy-paste snippets.
- Reference pages for landlords / tenants / properties / complaints each load standalone and link to the sandbox console.
- Homepage footer links to the docs; sitemap and meta tags are populated.
- Admin "Pause new developer signups" toggle blocks `/developers/signup` immediately.

## 6. Out of scope (still)

- Paid plan checkout (master billing switch stays OFF — Free during beta).
- Multi-member developer orgs.
- OAuth client-credentials flow.
- Auto-issuing live keys on approval (admin still presses "Issue key" — by design, for auditability).
