## Database Indexing & Performance Tune-Up

### Current Health (just measured)

The database is actually in good shape — the System Health tile alarm threshold is well below where we are now:

| Metric | Value | Verdict |
|---|---|---|
| Connections | 20 / 90 | Comfortable |
| Memory | 58% | Healthy |
| Data disk | 21% | Healthy |
| Cache hit ratio | 99.96% | Excellent |
| Restarts since boot | 0 | Clean |

So this is **tuning**, not firefighting. The wins below come from removing the few real hot spots in `pg_stat_user_tables`.

### What's actually hot

After scanning every public table:

1. **`rent_card_serial_stock`** — biggest table (158 MB, 270k rows). 2.3 billion tuples read via sequential scan. Existing indexes cover most paths, but the `rcss_office_summary()` function filters `WHERE stock_type='office' AND status='available' AND pair_index IN (1, NULL)` and there is no index that combines those three.
2. **`admin_audit_log`** — only the primary key exists. Queried by `admin_user_id` and `created_at` on every Activity Logs tab load.
3. **`notifications`** — the existing `idx_notifications_user_unread` is never used (column order doesn't match the query). Bell badge does `WHERE user_id = ? AND read_at IS NULL`.
4. **`tenancies`** — already well-indexed, but the auto-expire job scans by `end_date` + statuses; existing partial index is fine, no change needed.
5. **Small tables** (admin_staff, user_roles, landlords, offices, tenants, properties, feature_flags, case_payments, escrow_transactions, payment_receipts) — sequential scans here are correct: Postgres deliberately ignores indexes on tables this small. Adding more would slow writes for no read benefit.

### Plan

**Single migration adding/replacing these indexes (all `CONCURRENTLY` so no downtime):**

1. `rent_card_serial_stock` — partial index for the office-summary path:
   ```
   CREATE INDEX CONCURRENTLY idx_rcss_office_available
   ON rent_card_serial_stock (stock_type, office_name, region)
   WHERE status = 'available' AND (pair_index = 1 OR pair_index IS NULL);
   ```

2. `admin_audit_log` — two indexes covering the Activity Logs query:
   ```
   CREATE INDEX CONCURRENTLY idx_admin_audit_log_user_created
     ON admin_audit_log (admin_user_id, created_at DESC);
   CREATE INDEX CONCURRENTLY idx_admin_audit_log_created
     ON admin_audit_log (created_at DESC);
   ```

3. `notifications` — drop the unused partial index, replace with one that matches the unread-badge query:
   ```
   DROP INDEX IF EXISTS idx_notifications_user_unread;
   CREATE INDEX CONCURRENTLY idx_notifications_user_unread
     ON notifications (user_id, created_at DESC)
     WHERE read_at IS NULL;
   ```

4. `admin_activity_log` — add a composite for the Activity Logs filter (user + time):
   ```
   CREATE INDEX CONCURRENTLY idx_admin_activity_user_created
     ON admin_activity_log (user_id, created_at DESC);
   ```

5. Run `ANALYZE` on the four tables so the planner picks up the new stats immediately.

### What I am NOT doing (and why)

- **No new indexes on small tables** (`user_roles`, `admin_staff`, `landlords`, `case_payments`, `escrow_transactions`, `payment_receipts`, `offices`, `properties`, `feature_flags`). They already have what they need; Postgres correctly chooses sequential scans because the entire table fits in a couple of pages. Adding indexes would only slow inserts.
- **No app-code changes.** This is a pure schema/index migration.
- **No instance upgrade.** Headroom is fine; no reason to spend on a bigger tier today.

### Expected impact

- `rcss_office_summary` (used everywhere stock counts are shown) — drops from a full scan of 270k rows to a tiny partial-index scan.
- Activity Logs tab load — drops from a full scan of 34k+ activity rows + full scan of audit rows to indexed lookups.
- Notification bell — unread query becomes an index-only scan.
- System Health tile stays green; `db_connections_pct` and tuple-read counters should both move down on the next snapshot.

If you want, after this lands I can also schedule a `VACUUM ANALYZE` and a one-time `REINDEX CONCURRENTLY` on `rent_card_serial_stock` to reclaim bloat — say the word and I'll add it.
