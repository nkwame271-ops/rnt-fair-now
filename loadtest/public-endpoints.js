import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars');
}

const errors = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{name:verify_form}': ['p(95)<2000'],
    'http_req_duration{name:lookup_phone}': ['p(95)<1500'],
    'errors': ['rate<0.05'],
  },
};

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  // verify-form is the public QR verification — should be fast and cacheable
  const fakeRef = `RC-${Math.floor(Math.random() * 1000000)}`;
  const verify = http.post(
    `${SUPABASE_URL}/functions/v1/verify-form`,
    JSON.stringify({ reference: fakeRef }),
    { headers, tags: { name: 'verify_form' } }
  );
  const verifyOk = check(verify, {
    'verify reachable': (r) => r.status >= 200 && r.status < 500,
  });
  errors.add(!verifyOk);

  sleep(Math.random() * 2 + 1);

  // lookup-phone — used during signup checks
  const fakePhone = `233${Math.floor(200000000 + Math.random() * 99999999)}`;
  const lookup = http.post(
    `${SUPABASE_URL}/functions/v1/lookup-phone`,
    JSON.stringify({ phone: fakePhone }),
    { headers, tags: { name: 'lookup_phone' } }
  );
  check(lookup, { 'lookup reachable': (r) => r.status >= 200 && r.status < 500 });

  sleep(Math.random() * 3 + 2);
}
