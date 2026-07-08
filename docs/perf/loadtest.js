// Load test for the Ethara SAPSM backend.
//
// Runs against a live deployment and probes the four hottest endpoints:
//   - GET /api/v1/employees                (paginated, filtered list)
//   - GET /api/v1/seats?building=B1&floor=1 (200 rows, indexed)
//   - GET /api/v1/dashboard/overview        (5 aggregate queries)
//   - GET /api/v1/allocations               (paginated join-heavy list)
//
// Usage:
//   BASE=https://ethara-sapsm.onrender.com k6 run docs/perf/loadtest.js
//
// Success criteria: p95 under 800ms with 50 concurrent VUs over 30s.
// (Render free tier tops out at ~50 concurrent connections and shares a
// vCPU across services — a real prod plan would be well under 200ms.)

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://127.0.0.1:8000";
const PASSWORD = __ENV.PASSWORD || "demo1234";

export const options = {
  stages: [
    { duration: "10s", target: 20 },   // ramp
    { duration: "30s", target: 50 },   // hold at 50 VUs
    { duration: "10s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],  // p95 under 800ms
    http_req_failed: ["rate<0.02"],    // <2% error rate
  },
};

const employeesTrend = new Trend("employees_ms", true);
const seatsTrend = new Trend("seats_ms", true);
const overviewTrend = new Trend("dashboard_overview_ms", true);
const allocationsTrend = new Trend("allocations_ms", true);
const authRate = new Rate("auth_ok");

export function setup() {
  const r = http.post(
    `${BASE}/api/v1/auth/login`,
    { username: "admin", password: PASSWORD },
  );
  check(r, { "login 200": (res) => res.status === 200 });
  return { token: r.json("access_token") };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  // 1. Employees list, page 1
  const r1 = http.get(`${BASE}/api/v1/employees?limit=25&offset=0`, { headers });
  employeesTrend.add(r1.timings.duration);
  check(r1, { "employees 200": (r) => r.status === 200 });

  // 2. Seat map for B1 floor 1
  const r2 = http.get(`${BASE}/api/v1/seats?limit=200&building=B1&floor=1`, {
    headers,
  });
  seatsTrend.add(r2.timings.duration);
  check(r2, { "seats 200": (r) => r.status === 200 });

  // 3. Dashboard overview (5 aggregate queries under the hood)
  const r3 = http.get(`${BASE}/api/v1/dashboard/overview`, { headers });
  overviewTrend.add(r3.timings.duration);
  check(r3, { "overview 200": (r) => r.status === 200 });

  // 4. Active allocations
  const r4 = http.get(
    `${BASE}/api/v1/allocations?active_only=true&limit=25`,
    { headers },
  );
  allocationsTrend.add(r4.timings.duration);
  check(r4, { "allocations 200": (r) => r.status === 200 });

  authRate.add(true);
  sleep(1);
}
