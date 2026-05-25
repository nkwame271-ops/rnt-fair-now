# Load Testing — Rent Control Ghana

k6 scripts to validate the platform under projected load (target: 1M users, peak ~10k concurrent).

## Install k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

## Run

Set env vars first (use the **published** site, not the preview, so you're hitting real infra):

```bash
export BASE_URL="https://rentcontrolghana.com"
export SUPABASE_URL="https://qjrvwcwmhuxygdanbxsz.supabase.co"
export SUPABASE_ANON_KEY="<anon key from src/integrations/supabase/client.ts>"
```

Then:

```bash
# Smoke (1 VU, 30s) — sanity check before any real run
k6 run loadtest/smoke.js

# Read-heavy baseline (ramp 0→500 VUs over 5min, hold 10min)
k6 run loadtest/read-heavy.js

# Public endpoints stress (verify-form, lookup-phone, contact)
k6 run loadtest/public-endpoints.js

# Auth flow (signup → OTP → verify) — runs against test phone numbers only
k6 run loadtest/auth-flow.js
```

## What we test

| Script | Targets | Goal |
|---|---|---|
| `smoke.js` | Homepage + 1 RPC | Catch broken deploys |
| `read-heavy.js` | `get_regulator_dashboard_stats`, public property browse | Verify Phase 3 indexes + MVs hold up |
| `public-endpoints.js` | `verify-form`, `lookup-phone`, `contact-assistant` | Catch rate limit / abuse surface |
| `auth-flow.js` | `send-otp`, `verify-otp` (test numbers only) | Confirm Arkesel queueing doesn't break |

## SLOs

- p95 latency < 800ms for dashboard RPCs
- p95 latency < 1.5s for public read endpoints
- Error rate < 1% across all checks
- DB connection saturation < 70% (monitor via `supabase--db_health` during run)

## Safety

**Never run write-heavy load tests against production without coordinating first.** The escrow ledger, SMS sender, and Paystack webhook all have real-world side effects. Use the read-heavy scripts for routine capacity checks; reserve `auth-flow.js` and any future write tests for a staging environment or a dedicated load-test window.
