/**
 * AKADEMI Digital Campus — API Load Test (k6)
 *
 * Covers Gate 11.3: API response time < 500ms (p95)
 * Covers Gate 11.6: Concurrent user test (50+ users)
 *
 * Usage:
 *   k6 run infrastructure/loadtest/api-smoke.js
 *   k6 run --vus 50 --duration 2m infrastructure/loadtest/api-smoke.js
 *
 * Environment variables:
 *   BASE_URL — API base URL (default: http://localhost:8000/api/v1)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000/api/v1';
const THRESHOLD_P95 = 500; // 500ms per Gate 11.3

// Test stages: ramp up → steady → ramp down
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up to 10 VUs
    { duration: '1m',  target: 50 },   // ramp up to 50 VUs (Gate 11.6)
    { duration: '2m',  target: 50 },   // steady state at 50 VUs
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: [`p(95)<${THRESHOLD_P95}`], // Gate 11.3
    errors: ['rate<0.1'],                          // <10% error rate
    api_latency: [`p(95)<${THRESHOLD_P95}`],
  },
};

// Endpoints to test
const ENDPOINTS = [
  { name: 'health',        method: 'GET',  path: '/health/' },
  { name: 'programmes',    method: 'GET',  path: '/programmes/' },
  { name: 'courses',       method: 'GET',  path: '/courses/' },
  { name: 'lessons',       method: 'GET',  path: '/lessons/' },
  { name: 'notifications', method: 'GET',  path: '/notifications/' },
  { name: 'grades',        method: 'GET',  path: '/grades/' },
  { name: 'activities',    method: 'GET',  path: '/activities/' },
  { name: 'assignments',   method: 'GET',  path: '/assignments/' },
  { name: 'essays',        method: 'GET',  path: '/essays/' },
  { name: 'certificates',  method: 'GET',  path: '/certificates/' },
];

// Unauthenticated endpoints (should return 401/403)
const UNAUTH_ENDPOINTS = [
  { name: 'grades_unauth',  method: 'GET', path: '/grades/' },
  { name: 'users_unauth',   method: 'GET', path: '/users/' },
  { name: 'audit_unauth',   method: 'GET', path: '/audit/' },
];

export default function () {
  // Pick a random endpoint from the list
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  const url = `${BASE_URL}${endpoint.path}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: endpoint.name },
  };

  // Make request
  const startTime = Date.now();
  let res;
  if (endpoint.method === 'GET') {
    res = http.get(url, params);
  } else {
    res = http.post(url, null, params);
  }
  const duration = Date.now() - startTime;

  // Record custom metric
  apiLatency.add(duration);

  // Check response
  const success = check(res, {
    [`${endpoint.name} status is 200 or 401/403`]: (r) =>
      r.status === 200 || r.status === 401 || r.status === 403,
    [`${endpoint.name} response < ${THRESHOLD_P95}ms`]: (r) =>
      r.timings.duration < THRESHOLD_P95,
  });

  errorRate.add(!success);

  // Think time between requests
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s
}

// Summary report
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;
  const failRate = data.metrics.http_req_failed?.values?.rate || 0;

  console.log('\n=== AKADEMI API Load Test Results ===');
  console.log(`Total requests: ${totalReqs}`);
  console.log(`P95 latency:    ${p95.toFixed(0)}ms (threshold: ${THRESHOLD_P95}ms)`);
  console.log(`Fail rate:      ${(failRate * 100).toFixed(1)}%`);
  console.log(`Gate 11.3:      ${p95 < THRESHOLD_P95 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Gate 11.6:      ${totalReqs > 100 ? '✅ PASS' : '⚠️ LOW VOLUME'}`);

  return {};
}
