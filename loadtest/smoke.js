import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://rentcontrolghana.com';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage 200': (r) => r.status === 200,
    'has html': (r) => (r.body || '').includes('<html'),
  });
  sleep(1);
}
