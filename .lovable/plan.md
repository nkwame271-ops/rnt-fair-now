## Current system health — concurrency snapshot

Right now, on this exact moment:

- Backend status: healthy
- DB connections in use: **29 of 60 max** (Lovable Cloud default instance)
- Active queries: 2 • Idle: 19 • Waiting on locks: **0**
- Deadlocks since boot: **0**
- Cache hit ratio: **~99.99%** (excellent — almost nothing hits disk)
- Last 5 health snapshots: all green, no receipt drift, no unreconciled payments, dashboard refreshing every ~60s

So today, with the pilot's traffic, concurrency is a non-issue. The honest picture for 1M users is different — that's what the plan below addresses.

## What actually happens today when 10 things hit at once

Three layers handle a request, each with its own concurrency behavior:

```text
Browser ──► Edge Function (Deno, isolated per request)
                │
                ├──► Postgres (max 60 connections, PgBouncer pools them)
                │
                └──► Paystack / Arkesel / Resend (external APIs)
```

1. **Edge functions** scale horizontally and automatically. 10 simultaneous calls = 10 isolated Deno workers. No shared memory, no race conditions between them.
2. **Postgres** is the real bottleneck. Every request opens a connection through PgBouncer. With `max_connections=60`, the platform can serve a few hundred concurrent users comfortably before requests start queueing.
3. **Row-level races** already exist in a few critical paths and are handled with proper primitives:
   - `assign_serials_atomic` / `unassign_serial_atomic` — use `SELECT … FOR UPDATE` row locks
   - `try_finalize_lock(reference)` — uses `pg_try_advisory_xact_lock` for Paystack webhooks (prevents double-finalization if Paystack retries)
   - `case_payments_guard` trigger — blocks clients from mutating reconciliation fields
   - `enforce_room_capacity`, `prevent_unit_rent_unlock`, `check_ghana_card_uniqueness` triggers — enforced inside the transaction
4. **Known concurrency-fragile spots** not yet hardened:
   - **Registration flow** — the bug Margaret and Imam just hit: `auth.signUp → profiles update → tenants insert` is a 3-step client-side sequence. If the second or third step fails or the user closes the tab, you get an orphan. The paystack-checkout self-heal I added is the band-aid; the real fix is a single server-side RPC.
   - **Sequence-based IDs** (`tenant_id = "TN-2026-" + random 4 digits`) — collisions become statistically likely past ~1,000 registrations/year. Should move to a Postgres `nextval` sequence.
   - **Receipt number generation** — already uses `nextval('receipt_number_seq')` ✅
   - **Case numbers** — already use `nextval('case_number_seq')` ✅
   - **No optimistic locking** on rent updates, tenancy edits, complaint status. Last-writer-wins. Usually fine, but two admins editing the same complaint will silently overwrite each other.

## What breaks at scale (and at roughly what point)

| Users | Symptom | Root cause |
|---|---|---|
| ~500 concurrent | Occasional `connection slot full` errors | `max_connections=60` |
| ~2,000 concurrent reads | Dashboard slows, mv refresh contends | Materialized view refreshed every 5 min, locks readers briefly |
| ~10,000/day signups | Duplicate `tenant_id` collisions | 4-digit random suffix |
| Any scale | Two admins edit same complaint | No optimistic locking / last-write-wins |
| Any scale | Paystack webhook retried | Already handled by `try_finalize_lock` ✅ |
| 1M users | Backend exhausted | Compute instance size, not code |

## Plan — make the system concurrency-safe in 4 stages

### Stage A — Eliminate multi-step client transactions (highest leverage)

Convert the fragile flows into single server-side RPCs that run atomically:

- **`register_tenant_atomic(...)`** — wraps signUp + profile + tenants insert in one transaction with proper rollback. Removes the orphan-record class of bugs permanently.
- **`register_landlord_atomic(...)`** — same.
- **`update_complaint_with_version(id, expected_version, patch)`** — optimistic lock; rejects stale writes with a clear error.

### Stage B — Replace random IDs with sequences

- New sequences `tenant_id_seq`, `landlord_id_seq`, `property_id_seq`.
- Trigger-generated on insert, format `TN-2026-000001`.
- One-time migration to renumber existing rows or grandfather them.

### Stage C — Tighten the hot paths

- Add `SELECT … FOR UPDATE` to a few remaining places that read-then-write without a lock (rent-increase approvals already do this ✅; check tenancy renewals, rent-card activation).
- Switch `mv_office_dashboard_stats` refresh from "every 5 min full refresh" to `REFRESH … CONCURRENTLY` (already partially done — verify the fallback path isn't taken regularly).
- Add composite indexes on the 3-4 query patterns that show up in slow logs (need to capture those first).

### Stage D — Capacity for real traffic

Code can only do so much. For 1M users:

- **Upgrade the Lovable Cloud instance** — Backend → Advanced settings → Upgrade instance. Bigger instances ship with more `max_connections`, more RAM for cache, more CPU. This is the single biggest lever.
- **Move heavy reads behind the materialized views** you already have (`mv_global_dashboard_stats`, `mv_office_dashboard_stats`) so the dashboard never hits live tables under load.
- **Put Cloudflare in front** for static assets and to absorb DDoS / scraper traffic.

### What I am NOT proposing

- ❌ A custom Postgres rate-limiter table — already rejected as a band-aid; correct layer is Cloudflare.
- ❌ A queue/worker system (Inngest, etc.) for normal requests — current workload doesn't need it. Reserve for batch jobs only.
- ❌ Caching layer (Redis) — premature. Materialized views give you 90% of the benefit with no new infra.

## Recommended order

1. **Stage A** first (atomic registration RPCs) — fixes a real bug class users are hitting *today*.
2. **Stage B** (sequence-based IDs) — cheap, prevents future-you headache.
3. **Stage C** (locks + indexes) — driven by what slow-query logs show.
4. **Stage D** (instance upgrade) — when monitoring shows connection saturation, not before.

Tell me which stage to start with — I'd recommend A.