import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const BASE_URL = __ENV.BASE_URL || 'https://rentcontrolghana.com';

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars');
}

const dashboardLatency = new Trend('dashboard_rpc_latency');
const browseLatency = new Trend('browse_properties_latency');
const errors = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '10m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'dashboard_rpc_latency': ['p(95)<800'],
    'browse_properties_latency': ['p(95)<1500'],
    'errors': ['rate<0.01'],
    'http_req_failed': ['rate<0.02'],
  },
};

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  // 1. Public property browse (anonymous)
  const browse = http.get(
    `${SUPABASE_URL}/rest/v1/properties?select=id,address,rent_amount&status=eq.vacant&limit=20`,
    { headers, tags: { name: 'browse_properties' } }
  );
  browseLatency.add(browse.timings.duration);
  const browseOk = check(browse, { 'browse 200': (r) => r.status === 200 });
  errors.add(!browseOk);

  sleep(Math.random() * 2);

  // 2. Dashboard stats RPC (Phase 3 MV-backed, expects auth — will 401 anon; that's expected)
  // We still measure latency to confirm the auth check itself is fast.
  const stats = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_regulator_dashboard_stats`,
    JSON.stringify({ p_office_id: null }),
    { headers, tags: { name: 'dashboard_rpc' } }
  );
  dashboardLatency.add(stats.timings.duration);
  check(stats, { 'rpc reachable': (r) => r.status === 200 || r.status === 401 || r.status === 403 });

  sleep(Math.random() * 3 + 1);

  // 3. Homepage render
  const home = http.get(`${BASE_URL}/`, { tags: { name: 'homepage' } });
  check(home, { 'home 200': (r) => r.status === 200 });

  sleep(Math.random() * 5 + 2);
}
