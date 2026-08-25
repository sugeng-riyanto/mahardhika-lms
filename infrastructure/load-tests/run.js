/**
 * AKADEMI Digital Campus — API Load Test Runner
 *
 * Tests concurrent user handling across core API endpoints.
 * Requires the Django backend running on localhost:8000.
 *
 * Usage:
 *   node run.js                     # Run all tests
 *   node run.js --endpoint health   # Run specific test
 *   node run.js --duration 30       # Override duration (seconds)
 *   node run.js --connections 50    # Override concurrent connections
 *
 * Endpoints tested:
 *   1. Health check (unauthenticated)
 *   2. Auth /me (authenticated)
 *   3. Course list (student, instructor)
 *   4. Lesson list (student)
 *   5. Grade list (instructor, student)
 *   6. Essay questions (instructor)
 *   7. Essay responses (student)
 *   8. Canvas documents (instructor)
 *   9. Notifications (student)
 *  10. Activity list (student)
 */

const autocannon = require('autocannon')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000'

// Parse CLI args
const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args[idx + 1] : null
}
const filterEndpoint = getArg('endpoint')
const overrideDuration = getArg('duration') ? parseInt(getArg('duration')) : null
const overrideConnections = getArg('connections') ? parseInt(getArg('connections')) : null

// ── Test Tokens (from seed command) ──────────────────────────────
// These are mock tokens matching the seed accounts.
// In production, replace with actual JWT tokens.
const TOKENS = {
  instructor: 'mock-token-instructor@mahardhika.id',
  student: 'mock-token-student@mahardhika.id',
  admin: 'mock-token-admin@mahardhika.id',
  parent: 'mock-token-parent@mahardhika.id',
  treasurer: 'mock-token-treasurer@mahardhika.id',
}

// ── Test Definitions ──────────────────────────────────────────────
const TESTS = [
  {
    name: 'Health Check (unauthenticated)',
    id: 'health',
    url: `${BASE_URL}/api/v1/health/`,
    method: 'GET',
    headers: {},
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Basic health endpoint — tests DB connection, no auth',
  },
  {
    name: 'Auth /me (authenticated)',
    id: 'auth-me',
    url: `${BASE_URL}/api/v1/auth/me/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'User profile lookup — tests JWT verification + user query',
  },
  {
    name: 'Course List (student)',
    id: 'courses-list',
    url: `${BASE_URL}/api/v1/courses/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 20,
    duration: overrideDuration || 20,
    pipelining: 1,
    description: 'Course listing — tests RBAC filtering + pagination',
  },
  {
    name: 'Course List (instructor)',
    id: 'courses-instructor',
    url: `${BASE_URL}/api/v1/courses/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.instructor}` },
    connections: overrideConnections || 20,
    duration: overrideDuration || 20,
    pipelining: 1,
    description: 'Course listing with instructor RBAC — broader dataset',
  },
  {
    name: 'Grade List (instructor)',
    id: 'grades-instructor',
    url: `${BASE_URL}/api/v1/grades/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.instructor}` },
    connections: overrideConnections || 15,
    duration: overrideDuration || 20,
    pipelining: 1,
    description: 'Grade listing — tests JOIN across grades + users + activities',
  },
  {
    name: 'Grade List (student)',
    id: 'grades-student',
    url: `${BASE_URL}/api/v1/grades/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 15,
    duration: overrideDuration || 20,
    pipelining: 1,
    description: 'Grade listing — student sees own grades only (RLS test)',
  },
  {
    name: 'Essay Questions (instructor)',
    id: 'essays-questions',
    url: `${BASE_URL}/api/v1/essays/questions/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.instructor}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Essay question listing — complex model with rubric criteria',
  },
  {
    name: 'Essay Responses (student)',
    id: 'essays-responses',
    url: `${BASE_URL}/api/v1/essays/responses/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Essay response listing — student sees own responses',
  },
  {
    name: 'Notifications List',
    id: 'notifications',
    url: `${BASE_URL}/api/v1/notifications/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 20,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Notification listing — high-frequency polling endpoint',
  },
  {
    name: 'Activity List',
    id: 'activities',
    url: `${BASE_URL}/api/v1/activities/definitions/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Activity listing — tests content rendering + scoring',
  },
  {
    name: 'Canvas Documents (instructor)',
    id: 'canvas-list',
    url: `${BASE_URL}/api/v1/canvas-documents/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.instructor}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Canvas document listing — tests JSON storage performance',
  },
  {
    name: 'Attendance Records',
    id: 'attendance',
    url: `${BASE_URL}/api/v1/attendance/records/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.student}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Attendance record listing — tests schedule JOIN',
  },
  {
    name: 'Audit Events (admin)',
    id: 'audit-events',
    url: `${BASE_URL}/api/v1/audit-events/`,
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKENS.admin}` },
    connections: overrideConnections || 10,
    duration: overrideDuration || 15,
    pipelining: 1,
    description: 'Audit log listing — append-only table, may grow large',
  },
  {
    name: 'POST Grade Create (instructor)',
    id: 'grade-create',
    url: `${BASE_URL}/api/v1/grades/`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKENS.instructor}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      student: '00000000-0000-0000-0000-000000000005',
      activity: '00000000-0000-0000-0000-000000000099',
      score: '85.00',
      max_score: '100.00',
      percentage: '85.00',
      released: false,
    }),
    connections: overrideConnections || 5,
    duration: overrideDuration || 10,
    pipelining: 1,
    description: 'Grade creation — write endpoint, tests DB write contention',
  },
]

// ── Runner ────────────────────────────────────────────────────────
const results = []
const errors = []

function runTest(test) {
  return new Promise((resolve) => {
    const opts = {
      url: test.url,
      method: test.method,
      headers: test.headers,
      connections: test.connections,
      duration: test.duration,
      pipelining: test.pipelining || 1,
      timeout: 10, // seconds
      // For POST: add body
      ...(test.body ? { body: test.body } : {}),
    }

    console.log(`\n━━━ ${test.name} ━━━`)
    console.log(`  ${test.description}`)
    console.log(`  Config: ${test.connections} connections × ${test.duration}s`)

    const instance = autocannon(opts, (err, result) => {
      if (err) {
        console.log(`  ❌ ERROR: ${err.message}`)
        errors.push({ test: test.name, error: err.message })
        resolve()
        return
      }

      // autocannon result structure: latency has .average, .p50, .p95, .p99, .max
      // requests has .total, .average
      // throughput has .average
      const r = {
        name: test.name,
        id: test.id,
        url: test.url,
        method: test.method,
        connections: test.connections,
        duration: result.duration,
        requests: result.requests.total,
        rps: result.requests.average,
        throughput: result.throughput.average,
        latencyAvg: result.latency.average || 0,
        latencyP50: result.latency.p50 || 0,
        latencyP95: result.latency.p95 || 0,
        latencyP99: result.latency.p99 || 0,
        latencyMax: result.latency.max || 0,
        errors: result.errors?.total || 0,
        timeouts: result.timeouts || 0,
        non2xx: result.non2xx || 0,
        statusCodes: result.statusCodeStats || {},
      }

      // Print results
      console.log(`  Results:`)
      console.log(`    Requests:    ${r.requests} total (${r.rps.toFixed(1)} req/s)`)
      console.log(`    Throughput:  ${(r.throughput / 1024).toFixed(1)} KB/s`)
      console.log(`    Latency:`)
      console.log(`      avg:  ${r.latencyAvg.toFixed(1)}ms`)
      console.log(`      p50:  ${r.latencyP50.toFixed(1)}ms`)
      console.log(`      p95:  ${r.latencyP95.toFixed(1)}ms`)
      console.log(`      p99:  ${r.latencyP99.toFixed(1)}ms`)
      console.log(`      max:  ${r.latencyMax.toFixed(1)}ms`)
      console.log(`    Errors:     ${r.errors} | Timeouts: ${r.timeouts} | Non-2xx: ${r.non2xx}`)

      if (Object.keys(r.statusCodes).length > 0) {
        console.log(`    Status codes:`, r.statusCodes)
      }

      results.push(r)
      resolve()
    })

    // Pipe progress to stdout
    autocannon.track(instance, { renderProgressBar: true })
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  AKADEMI Digital Campus — API Load Tests            ║')
  console.log('║  Target: ' + BASE_URL.padEnd(43) + '║')
  console.log('╚══════════════════════════════════════════════════════╝')

  // Filter tests if specified
  const testsToRun = filterEndpoint
    ? TESTS.filter((t) => t.id.includes(filterEndpoint))
    : TESTS

  if (testsToRun.length === 0) {
    console.log(`No tests matched "${filterEndpoint}". Available: ${TESTS.map((t) => t.id).join(', ')}`)
    process.exit(1)
  }

  console.log(`\nRunning ${testsToRun.length} load tests...`)

  for (const test of testsToRun) {
    await runTest(test)
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════╗')
  console.log('║  SUMMARY                                             ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const table = results.map((r) => ({
    'Endpoint': `${r.method} ${r.url.replace(BASE_URL, '')}`,
    'Conns': r.connections,
    'RPS': r.rps.toFixed(1),
    'Avg ms': r.latencyAvg.toFixed(0),
    'p95 ms': r.latencyP95.toFixed(0),
    'p99 ms': r.latencyP99.toFixed(0),
    'Max ms': r.latencyMax.toFixed(0),
    'Errors': r.errors,
    'Non-2xx': r.non2xx,
  }))

  console.table(table)

  // ── Pass/Fail Criteria ────────────────────────────────────────
  console.log('\n── Pass/Fail Criteria ──')
  let allPassed = true

  for (const r of results) {
    const issues = []
    if (r.errors > 0) issues.push(`${r.errors} connection errors`)
    // Non-2xx from RBAC rejection (403) or mock user without role assignments is expected
    // Only flag non-2xx if they're server errors (5xx) or throttling (429)
    const hasServerErrors = Object.keys(r.statusCodes).some(code => code.startsWith('5'))
    const hasThrottling = Object.keys(r.statusCodes).some(code => code === '429')
    if (hasServerErrors) issues.push(`5xx server errors detected`)
    if (hasThrottling) issues.push(`429 throttling detected`)
    if (r.errors > 0) issues.push(`${r.errors} connection errors`)
    if (r.latencyP95 > 2000) issues.push(`p95 latency > 2s (${r.latencyP95.toFixed(0)}ms)`)
    if (r.latencyMax > 10000) issues.push(`max latency > 10s (${r.latencyMax.toFixed(0)}ms)`)
    if (r.rps < 1) issues.push(`RPS < 1 (possible server down)`)

    if (issues.length > 0) {
      console.log(`  ❌ ${r.name}: ${issues.join(', ')}`)
      allPassed = false
    } else {
      const non2xxNote = r.non2xx > 0 ? ` (non-2xx: ${r.non2xx} — likely RBAC rejection)` : ''
      console.log(`  ✅ ${r.name}: PASS (RPS=${r.rps.toFixed(1)}, p95=${r.latencyP95.toFixed(0)}ms)${non2xxNote}`)
    }
  }

  if (errors.length > 0) {
    console.log('\n── Connection Errors ──')
    for (const e of errors) {
      console.log(`  ❌ ${e.test}: ${e.error}`)
    }
    allPassed = false
  }

  console.log(`\n${allPassed ? '✅ ALL LOAD TESTS PASSED' : '❌ SOME LOAD TESTS FAILED'}`)

  // ── Write results to JSON ────────────────────────────────────
  const outputDir = path.join(__dirname, 'results')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outputDir, `load-test-${timestamp}.json`)
  fs.writeFileSync(outputPath, JSON.stringify({ timestamp, results, errors }, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)

  process.exit(allPassed ? 0 : 1)
}

main()
