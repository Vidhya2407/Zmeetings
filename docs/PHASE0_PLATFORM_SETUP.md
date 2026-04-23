# Phase 0 Platform Setup

This repository now includes a free-first local platform baseline for:

- Next.js app
- PostgreSQL
- Redis
- MinIO (S3-compatible)
- Prometheus
- Grafana
- MongoDB (temporary compatibility for current repository APIs)

## Quick Start

1. Copy env template:

```bash
cp .env.docker.example .env
```

2. Start stack:

```bash
npm run phase0:up
```

3. Open services:

- App: `http://localhost:3000`
- App health: `http://localhost:3000/api/health`
- App liveness: `http://localhost:3000/api/health/live`
- App readiness: `http://localhost:3000/api/health/ready`
- Grafana: `http://localhost:3001`
- Prometheus: `http://localhost:9090`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MongoDB: `localhost:27017`

4. Stop stack:

```bash
npm run phase0:down
```

## CI

GitHub Actions workflow:

- `.github/workflows/ci.yml`

Pipeline checks:

1. `npm run check:env`
2. `npm run lint`
3. Playwright smoke test (`Meetings Core Smoke`)
4. `npm run build`
