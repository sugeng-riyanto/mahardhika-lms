# AKADEMI Load Tests

Load testing for Gate 11: Performance & Load Testing.

## Prerequisites

Install k6:
```bash
# Windows (Scoop)
scoop install k6

# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo snap install k6
```

## Run Tests

### Smoke test (default: 50 VUs, 4 min)
```bash
k6 run infrastructure/loadtest/api-smoke.js
```

### With custom target
```bash
BASE_URL=https://akademi-staging-api.railway.app/api/v1 \
  k6 run --vus 50 --duration 3m infrastructure/loadtest/api-smoke.js
```

### Quick load test (100 VUs)
```bash
k6 run --vus 100 --duration 2m infrastructure/loadtest/api-smoke.js
```

## Thresholds

| Metric | Threshold | Gate |
|--------|-----------|------|
| P95 latency | < 500ms | 11.3 |
| Error rate | < 10% | — |
| Volume | > 100 requests | 11.6 |

## Output

k6 provides:
- **Console summary** with pass/fail for each threshold
- **JSON export**: `k6 run --out json=results.json ...`
- **Grafana integration**: `k6 run --out influxdb=... ...`
