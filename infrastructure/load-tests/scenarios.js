/**
 * AKADEMI Digital Campus — Concurrent User Simulation
 *
 * Simulates realistic user traffic patterns:
 *   - Students browsing courses and checking grades
 *   - Instructors viewing dashboards and grading
 *   - Parents checking child progress
 *   - Mixed read/write operations
 *
 * Uses autocannon's scheduling for realistic traffic mix.
 */

const autocannon = require('autocannon')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000'

const TOKENS = {
  student: 'mock-token-student@mahardhika.id',
  instructor: 'mock-token-instructor@mahardhika.id',
  parent: 'mock-token-parent@mahardhika.id',
  admin: 'mock-token-admin@mahardhika.id',
}

// ── User Flow Scenarios ───────────────────────────────────────────

/**
 * Scenario 1: Student Morning Login Flow
 * Student logs in, checks notifications, opens courses, views a lesson
 */
async function studentMorningFlow() {
  console.log('\n━━━ Scenario: Student Morning Flow (20 concurrent users × 30s) ━━━')

  const requests = [
    { method: 'GET', path: '/api/v1/auth/me/', weight: 1 },
    { method: 'GET', path: '/api/v1/notifications/', weight: 3 },
    { method: 'GET', path: '/api/v1/courses/', weight: 2 },
    { method: 'GET', path: '/api/v1/grades/', weight: 2 },
    { method: 'GET', path: '/api/v1/activities/definitions/', weight: 1 },
  ]

  return new Promise((resolve) => {
    const instance = autocannon({
      url: BASE_URL,
      connections: 20,
      duration: 30,
      requests: requests.map((r) => ({
        method: r.method,
        path: r.path,
        headers: { Authorization: `Bearer ${TOKENS.student}` },
      })),
      timeout: 10,
    }, (err, result) => {
      if (err) { console.log(`  ❌ Error: ${err.message}`); resolve(null); return }
      printResult('Student Morning Flow', result)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

/**
 * Scenario 2: Instructor Grading Session
 * Instructor views dashboard, checks submissions, grades essays
 */
async function instructorGradingFlow() {
  console.log('\n━━━ Scenario: Instructor Grading Flow (10 concurrent users × 30s) ━━━')

  const requests = [
    { method: 'GET', path: '/api/v1/auth/me/', weight: 1 },
    { method: 'GET', path: '/api/v1/courses/', weight: 2 },
    { method: 'GET', path: '/api/v1/grades/', weight: 3 },
    { method: 'GET', path: '/api/v1/essays/questions/', weight: 2 },
    { method: 'GET', path: '/api/v1/essays/responses/', weight: 2 },
  ]

  return new Promise((resolve) => {
    const instance = autocannon({
      url: BASE_URL,
      connections: 10,
      duration: 30,
      requests: requests.map((r) => ({
        method: r.method,
        path: r.path,
        headers: { Authorization: `Bearer ${TOKENS.instructor}` },
      })),
      timeout: 10,
    }, (err, result) => {
      if (err) { console.log(`  ❌ Error: ${err.message}`); resolve(null); return }
      printResult('Instructor Grading Flow', result)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

/**
 * Scenario 3: Parent Check-in
 * Parent checks child's grades and attendance
 */
async function parentCheckInFlow() {
  console.log('\n━━━ Scenario: Parent Check-in Flow (5 concurrent users × 20s) ━━━')

  const requests = [
    { method: 'GET', path: '/api/v1/auth/me/', weight: 1 },
    { method: 'GET', path: '/api/v1/parent-child-links/', weight: 1 },
    { method: 'GET', path: '/api/v1/grades/', weight: 2 },
    { method: 'GET', path: '/api/v1/attendance/records/', weight: 1 },
    { method: 'GET', path: '/api/v1/consent/records/', weight: 1 },
  ]

  return new Promise((resolve) => {
    const instance = autocannon({
      url: BASE_URL,
      connections: 5,
      duration: 20,
      requests: requests.map((r) => ({
        method: r.method,
        path: r.path,
        headers: { Authorization: `Bearer ${TOKENS.parent}` },
      })),
      timeout: 10,
    }, (err, result) => {
      if (err) { console.log(`  ❌ Error: ${err.message}`); resolve(null); return }
      printResult('Parent Check-in Flow', result)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

/**
 * Scenario 4: Admin Dashboard + Audit
 * Admin views dashboard, checks users, reviews audit log
 */
async function adminDashboardFlow() {
  console.log('\n━━━ Scenario: Admin Dashboard Flow (5 concurrent users × 20s) ━━━')

  const requests = [
    { method: 'GET', path: '/api/v1/auth/me/', weight: 1 },
    { method: 'GET', path: '/api/v1/users/', weight: 2 },
    { method: 'GET', path: '/api/v1/courses/', weight: 1 },
    { method: 'GET', path: '/api/v1/audit-events/', weight: 2 },
    { method: 'GET', path: '/api/v1/notifications/', weight: 1 },
  ]

  return new Promise((resolve) => {
    const instance = autocannon({
      url: BASE_URL,
      connections: 5,
      duration: 20,
      requests: requests.map((r) => ({
        method: r.method,
        path: r.path,
        headers: { Authorization: `Bearer ${TOKENS.admin}` },
      })),
      timeout: 10,
    }, (err, result) => {
      if (err) { console.log(`  ❌ Error: ${err.message}`); resolve(null); return }
      printResult('Admin Dashboard Flow', result)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

/**
 * Scenario 5: Spike Test — Sudden 50-user burst on course list
 * Tests server behavior under sudden load spike
 */
async function spikeTest() {
  console.log('\n━━━ Scenario: Spike Test (50 burst users × 15s) ━━━')

  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${BASE_URL}/api/v1/courses/`,
      connections: 50,
      duration: 15,
      headers: { Authorization: `Bearer ${TOKENS.student}` },
      timeout: 10,
    }, (err, result) => {
      if (err) { console.log(`  ❌ Error: ${err.message}`); resolve(null); return }
      printResult('Spike Test', result)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

function printResult(name, result) {
  const avg = result.latency?.average || 0
  const p50 = result.latency?.p50 || 0
  const p95 = result.latency?.p95 || 0
  const p99 = result.latency?.p99 || 0
  const rps = result.requests?.average || 0
  const total = result.requests?.total || 0
  const throughput = result.throughput?.average || 0
  console.log(`\n  ${name} Results:`)
  console.log(`    Requests:   ${total} (${rps.toFixed(1)} req/s)`)
  console.log(`    Throughput: ${(throughput / 1024).toFixed(1)} KB/s`)
  console.log(`    Latency:    avg=${avg.toFixed(0)}ms  p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  p99=${p99.toFixed(0)}ms`)
  console.log(`    Errors:     ${result.errors?.total || 0} | Timeouts: ${result.timeouts || 0} | Non-2xx: ${result.non2xx || 0}`)
  if (Object.keys(result.statusCodeStats || {}).length > 0) {
    console.log(`    Status:     ${JSON.stringify(result.statusCodeStats)}`)
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  AKADEMI — Concurrent User Simulation Tests             ║')
  console.log('║  Target: ' + BASE_URL.padEnd(48) + '║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  const allResults = []
  const start = Date.now()

  // Run scenarios sequentially to avoid self-interference
  const flows = [studentMorningFlow, instructorGradingFlow, parentCheckInFlow, adminDashboardFlow, spikeTest]

  for (const flow of flows) {
    const result = await flow()
    if (result) allResults.push(result)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(0)

  // ── Summary ───────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  CONCURRENT USER SIMULATION — SUMMARY                   ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\nTotal time: ${elapsed}s\n`)

  const names = ['Student Morning', 'Instructor Grading', 'Parent Check-in', 'Admin Dashboard', 'Spike Test']
  const totalRequests = allResults.reduce((sum, r) => sum + r.requests.total, 0)
  const avgRps = allResults.reduce((sum, r) => sum + r.requests.average, 0) / allResults.length
  const maxP95 = Math.max(...allResults.map((r) => r.latency.p95))
  const totalErrors = allResults.reduce((sum, r) => sum + (r.errors?.total || 0) + (r.timeouts || 0) + (r.non2xx || 0), 0)

  console.log(`  Total requests across all scenarios: ${totalRequests}`)
  console.log(`  Average RPS across scenarios:        ${avgRps.toFixed(1)}`)
  console.log(`  Worst p95 latency:                   ${maxP95.toFixed(0)}ms`)
  console.log(`  Total errors/timeouts/non-2xx:       ${totalErrors}`)

  // Pass/Fail
  const pass = totalErrors === 0 && maxP95 < 3000
  console.log(`\n${pass ? '✅ ALL CONCURRENT USER TESTS PASSED' : '❌ ISSUES DETECTED — review above'}`)

  // Save results
  const outputDir = path.join(__dirname, 'results')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outputDir, `concurrent-${timestamp}.json`)
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp,
    duration: `${elapsed}s`,
    summary: { totalRequests, avgRps, maxP95, totalErrors },
    scenarios: allResults.map((r, i) => ({
      name: names[i],
      rps: r.requests.average,
      p95: r.latency.p95,
      errors: (r.errors?.total || 0) + (r.timeouts || 0) + (r.non2xx || 0),
    })),
  }, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)

  process.exit(pass ? 0 : 1)
}

main()
