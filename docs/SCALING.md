# Scaling Playbook — Rent Control Ghana

Last updated: 2026-05-25 (after Stages A–D of the concurrency hardening work).

This document is the single reference for "what do we do when traffic grows".
It is paired with the live **System Health** tile on the Payment Reconciliation
Centre, which is the primary signal source.

---

## 1. What the system can handle today

Measured on the current Lovable Cloud default instance:

| Metric                | Today           | Headroom before action |
|-----------------------|-----------------|------------------------|
| `max_connections`     | 60              | upgrade at ~42 in use (70%) |
| Active connections    | ~2–5 typical    | comfortable            |
| Deadlocks since boot  | 0               | investigate at any growth |
| Cache hit ratio       | 99.99%          | excellent              |
| Dashboard cache age   | 0–60s           | refreshed every minute, CONCURRENTLY |

Edge functions scale automatically per request — they are **not** the bottleneck.
The bottleneck is always the database connection pool and, secondarily, RAM / CPU.

---

## 2. When to upgrade the Lovable Cloud instance

The **System Health** tile shows a live `db_connections_pct` bar:

- **Green (< 50%)** — nothing to do.
- **Amber (50–69%)** — watch over the next 24h, especially during peak.
- **Red (≥ 70%)** — the tile prompts to upgrade. Do it.

How to upgrade:

1. Open the project in Lovable.
2. Backend (sidebar) → **Advanced settings**.
3. Click **Upgrade instance** and pick the next tier.
4. Wait 2–5 minutes for the resize. The app stays online; in-flight requests may
   see brief retries.
5. Refresh the dashboard — `db_connections_max` in the health tile will reflect
   the new ceiling within ~15 minutes (when the next snapshot captures).

Larger instances bring more `max_connections`, more RAM (bigger Postgres cache),
and more CPU. There is **no code change required**.

Pricing note: larger instances increase Lovable Cloud usage. See
<https://docs.lovable.dev/integrations/cloud>.

---

## 3. What else to watch on the tile

| Metric                   | Healthy | Action if not |
|--------------------------|---------|----------------|
| Missing receipts         | 0       | Check `receipt-drift-monitor` logs |
| Missing receipt #        | 0       | A paid `case_payment` row has no receipt number → re-run reconciliation |
| Unreconciled             | 0       | A paid `case_payment` was not pushed to the ledger → check `reconcile_case_payment` |
| Open failures (24h)      | 0       | Inspect `receipt_generation_failures` table |
| Dashboard cache age      | < 90s   | Investigate `refresh_dashboard_stats` cron job |
| DB connections           | < 70%   | Upgrade instance (above) |

The tile auto-refreshes every minute and the underlying snapshot is captured
every 15 minutes by `cron.job: capture-system-health`.

---

## 4. Concurrency primitives already in place (do not duplicate)

- **Atomic account registration** — `register-account` edge function: signUp +
  profile + tenants/landlords insert in one shot. Rolls back the auth user on
  any failure. Sequence-based IDs (`generate_tenant_id`, `generate_landlord_id`)
  start at 100000 — no collisions.
- **Paystack webhook idempotency** — `try_finalize_lock(reference)` advisory lock.
- **Optimistic locking** — `complaints` / `landlord_complaints` carry a `version`
  column that auto-increments. Use `updateComplaintSafe()` from
  `src/lib/safeComplaintUpdate.ts` for any future complaint edit screen.
- **Row-level locks** on serial assignment, rent-increase approval, tenancy
  expiry cascade.
- **Materialized views** for the regulator dashboard — reads never hit live
  tables under load. Refreshed CONCURRENTLY every minute.

---

## 5. Beyond the database: when to add CDN / WAF

The Lovable preview/published URLs already sit behind Lovable hosting. If you
are seeing scraper traffic, abusive bots, or want geographic edge caching for
the static marketing pages:

1. Point your custom domain at Cloudflare (DNS only first, then proxy).
2. Set the `Always Use HTTPS` rule and a basic WAF managed ruleset.
3. **Page rules** — bypass cache for `/auth/*`, `/api/*`, anything that hits
   Supabase. Cache everything else with a short TTL.
4. Turn on **Bot Fight Mode** if scraper traffic appears.

This is the right layer for rate-limiting. Do **not** add rate-limit tables to
the database — the backend memory above explicitly forbids it.

---

## 6. What we deliberately did NOT build

- ❌ Redis cache — materialized views already give us 90% of the win.
- ❌ Queue worker (Inngest, etc.) for normal API traffic — not needed at this
  workload. We do use pgmq for the email queue, which is appropriate.
- ❌ Database-side rate limiting — wrong layer; use Cloudflare.
- ❌ Custom connection pooler — Supabase's PgBouncer is already in front.

Revisit these only if monitoring shows specific bottlenecks that match.

---

## 7. Stress test before milestones

The `loadtest/` directory contains k6 scripts (`smoke.js`, `read-heavy.js`,
`public-endpoints.js`, `auth-flow.js`). Before any major launch:

1. Run against **staging**, never production.
2. Start with `smoke.js` (1 VU, 30s) to verify the harness.
3. Then `read-heavy.js` (500 VUs, 15 min) — this is the realistic dashboard
   load test. Watch the System Health tile in parallel.
4. If `db_connections_pct` crosses 70% during the test, upgrade the instance
   tier and re-run before going live.
