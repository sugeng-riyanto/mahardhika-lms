/**
 * AKADEMI — Throughput Benchmark
 *
 * Gradually increases concurrent connections to find the server's
 * saturation point. Useful for capacity planning.
 *
 * Tests the health endpoint (lightest) and course list (heaviest read)
 * at increasing connection levels.
 */

const autocannon = require('autocannon')
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000'

const CONNECTION_LEVELS = [1, 5, 10, 20, 30, 50]
const DURATION = 10 // seconds per level

const ENDPOINTS = [
  {
    name: 'Health Check',
    url: `${BASE_URL}/api/v1/health/`,
    headers: {},
  },
  {
    name: 'Course List (student)',
    url: `${BASE_URL}/api/v1/courses/`,
    headers: { Authorization: 'Bearer mock-token-student@mahardhika.id' },
  },
  {
    name: 'Grade List (instructor)',
    url: `${BASE_URL}/api/v1/grades/`,
    headers: { Authorization: 'Bearer mock-token-instructor@mahardhika.id' },
  },
]

function runLevel(endpoint, connections) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: endpoint.url,
      headers: endpoint.headers,
      connections,
      duration: DURATION,
      timeout: 10,
    }, (err, result) => {
      if (err) {
        resolve({ connections, error: err.message })
        return
      }
      resolve({
        connections,
        rps: result.requests.average,
        p50: result.latency.p50,
        p95: result.latency.p95,
        p99: result.latency.p99,
        max: result.latency.max,
        errors: (result.errors?.total || 0) + (result.timeouts || 0) + (result.non2xx || 0),
      })
    })
    autocannon.track(instance, { renderProgressBar: true })
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  AKADEMI — Throughput Benchmark                         ║')
  console.log('║  Finding server saturation point across connection levels║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`Target: ${BASE_URL}`)
  console.log(`Connection levels: ${CONNECTION_LEVELS.join(', ')}`)
  console.log(`Duration per level: ${DURATION}s\n`)

  const allResults = []

  for (const endpoint of ENDPOINTS) {
    console.log(`\n═══ ${endpoint.name} ═══`)
    const levels = []

    for (const conn of CONNECTION_LEVELS) {
      console.log(`\n  Testing with ${conn} connection(s)...`)
      const result = await runLevel(endpoint, conn)
      levels.push(result)
      if (result.error) {
        console.log(`  ❌ Error at ${conn} connections: ${result.error}`)
        break
      }
      console.log(`  → RPS=${result.rps.toFixed(1)}  p95=${result.p95.toFixed(0)}ms  errors=${result.errors}`)
    }

    allResults.push({ endpoint: endpoint.name, levels })
  }

  // ── Summary Table ────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  BENCHMARK RESULTS                                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  for (const { endpoint, levels } of allResults) {
    console.log(`\n${endpoint}:`)
    console.log('  Conns │ RPS      │ p50     │ p95     │ p99     │ Max     │ Errors')
    console.log('  ──────┼──────────┼─────────┼─────────┼─────────┼─────────┼───────')
    for (const l of levels) {
      if (l.error) {
        console.log(`  ${String(l.connections).padStart(5)} │ ERROR    │ ${l.error}`)
        continue
      }
      console.log(
        `  ${String(l.connections).padStart(5)} │ ${String(l.rps.toFixed(1)).padStart(8)} │ ${String(l.p50.toFixed(0) + 'ms').padStart(7)} │ ${String(l.p95.toFixed(0) + 'ms').padStart(7)} │ ${String(l.p99.toFixed(0) + 'ms').padStart(7)} │ ${String(l.max.toFixed(0) + 'ms').padStart(7)} │ ${String(l.errors).padStart(5)}`
      )
    }

    // Find saturation point (where p95 > 1000ms or RPS stops growing)
    const validLevels = levels.filter((l) => !l.error)
    let saturationPoint = validLevels[validLevels.length - 1]?.connections || 0
    for (let i = 1; i < validLevels.length; i++) {
      const rpsDrop = validLevels[i].rps < validLevels[i - 1].rps * 0.9
      const latencySpike = validLevels[i].p95 > validLevels[i - 1].p95 * 2
      if (rpsDrop || latencySpike) {
        saturationPoint = validLevels[i - 1].connections
        break
      }
    }
    console.log(`  ↳ Estimated saturation point: ~${saturationPoint} concurrent connections`)
  }

  console.log('\n✅ Benchmark complete')
}

main()
