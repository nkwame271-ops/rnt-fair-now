import http from 'k6/http';
import { check, sleep } from 'k6';

// DO NOT RUN AGAINST PRODUCTION WITHOUT EXPLICIT APPROVAL.
// This script sends real OTP requests. Use test phone numbers only,
// and coordinate with the Arkesel quota before any high-VU run.

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const TEST_PHONE = __ENV.TEST_PHONE; // e.g. 233200000001 (must be a whitelisted test number)

if (!SUPABASE_URL || !ANON_KEY || !TEST_PHONE) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and TEST_PHONE env vars');
}

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  const res = http.post(
    `${SUPABASE_URL}/functions/v1/send-otp`,
    JSON.stringify({ phone: TEST_PHONE, purpose: 'loadtest' }),
    { headers, tags: { name: 'send_otp' } }
  );
  check(res, {
    'otp accepted or rate-limited': (r) => [200, 202, 429].includes(r.status),
  });
  sleep(10); // respect SMS provider rate
}
