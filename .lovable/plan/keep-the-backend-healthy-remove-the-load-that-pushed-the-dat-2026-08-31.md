# Keep the backend healthy — remove the load that pushed the database over

## What I confirmed (not guessed)

Live inspection of the database right now:

- **Backend is healthy again**: database up, PgBouncer up, 0 restarts, connections 33/60, memory 62%, disk 23%, size 1.46 GB, WAL 128 MB.
- **The scheduled jobs did fail during the bad window.** In the last 6 hours: the 1-minute `receipt-drift-monitor` job logged **144 failed** runs (last failure 15:24 UTC) and the 1-minute `refresh-dashboard-stats` job logged **127 failed** runs (last failure 15:23), plus 13 failures of the 15-minute health snapshot job. Everything after ~15:25 succeeded. So the outage window matches the jobs failing, not app code.
- **The drift monitor is by far the heaviest thing running.** It runs **every minute**, selects up to **1000** paid escrow rows, and then issues **one separate receipt lookup per row**. The stats prove it: the single-row `payment_receipts` lookup has been called **84,975 times** and `payment_receipts` has **456,282** index scans, against a table of only **4,061** rows. There are only 4,061 paid escrow transactions and 4,061 receipts — i.e. drift is normally zero and this whole scan is wasted work, once a minute, forever.
- **One query is pathologically slow for its size**: reading `hearing_rooms` — **670 rows** — averages **397 ms** and has burned **782 seconds** total across 1,971 calls, with **1,981 sequential scans and 0 index scans**. Two confirmed reasons: (a) `hearing_rooms` has **no index on `office_id`** (only the primary key), and (b) its RLS policy calls `admin_can_access_office()`, which is **`STABLE` but NOT `SECURITY DEFINER`** — so for every row it re-queries `admin_staff` and `offices` *through their own RLS policies*. Every other policy helper (`is_main_admin`, `has_role`) is `SECURITY DEFINER`; this one was missed.
- Other repeat offenders in the slow-query list are the same drift-monitor queries (`escrow_transactions` status scan, `escrow_splits` fetch) and a `rent_card_serial_stock` lookup averaging 700 ms.

Diagnosis: the database was not short of disk or connections. It was being fed a continuous, avoidable query load — a per-minute full-repair sweep plus an RLS helper that multiplies every row read into extra policy-checked queries — and under that baseline any traffic spike tipped it into the unhealthy state where cron jobs and app requests started erroring.

## What to change

### 1. Make the repair sweep cheap (biggest win)
- Replace the per-row receipt lookup with a **single set-based query** that returns only escrow rows genuinely missing a receipt. No more 85,000 one-row round trips.
- Drop the sweep from **every minute to every 15 minutes**, and make it exit immediately when drift is zero (the normal case).
- Keep the self-healing behaviour and failure logging exactly as it is — same repairs, same audit trail, just triggered on real drift instead of blindly.

### 2. Fix the RLS helper and the missing index
- Recreate `admin_can_access_office()` as **`SECURITY DEFINER`** (matching `is_main_admin` / `has_role`), so office-scope checks stop re-entering RLS on `admin_staff` and `offices`. Behaviour is unchanged — it still returns access only for the passed user.
- Add an index on `hearing_rooms(office_id)` (plus `active`), and indexes for the `rent_card_serial_stock` lookup columns that are currently doing 700 ms scans.

### 3. Stop the dashboard refresh from fighting the sweep
- Move the materialized-view refresh from **every minute to every 5 minutes**, and skip the refresh when the view is already fresh. The System Health tile already reports cache age, so staleness stays visible.

### 4. Make "unhealthy" visible before it hurts
- Extend the existing health snapshot to also record **failed scheduled-job runs in the last hour**, and surface it on the System Health tile alongside the current metrics. That is the signal that actually moved during this incident, and today nothing showed it.
- Raise the alert threshold logic so the tile turns red on repeated job failures, not only on ledger drift.

### 5. Document it
- Update `docs/SCALING.md` with the new job cadences and a short "what a database wobble looks like" section pointing at cron failure counts as the first thing to check.

## Notes

- No feature behaviour changes for landlords, tenants, agents, or regulators. Payments, receipts, reconciliation and complaint flows keep working identically.
- No compute or disk upgrade is needed at this point — the constraint was query load, not size. Connections at 33/60 and disk at 23% stay well inside the thresholds already documented.
- The RLS change is a privilege-scoped function rewrite; it does not widen who can see which office. I will verify after applying that a scoped admin still sees only their own offices' hearing rooms.

## Technical detail

- `supabase/functions/receipt-drift-monitor/index.ts`: replace the `for (const esc of orphanEscrows)` + `maybeSingle()` receipt probe with a single `select ... not.in` / anti-join style query (via an RPC returning missing-receipt escrow ids), then repair only those, capped as today.
- New migration: `create or replace function public.admin_can_access_office(uuid, text) ... security definer set search_path = public`; `create index idx_hearing_rooms_office_active on public.hearing_rooms(office_id, active)`; index for `rent_card_serial_stock(region, stock_type, status, pair_index)`; new RPC `list_escrows_missing_receipts(p_limit int)`.
- `cron.job`: reschedule jobid 4 (`receipt-drift-monitor-1min`) to `*/15 * * * *` and rename, jobid 5 (`refresh-dashboard-stats`) to `*/5 * * * *`.
- `capture_system_health_snapshot()`: add `failed_cron_runs_1h` from `cron.job_run_details`; add the column to `system_health_snapshots` and render it in `src/components/regulator/SystemHealthTile.tsx`.
