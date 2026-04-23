# Production v1 Go-Live

## Scope

This stack targets a free-first, single-region launch:

- 1 Linux host
- Next.js app container
- MongoDB for the current repository data model
- Single-home LiveKit SFU
- Caddy for TLS termination
- Prometheus + Alertmanager + Grafana
- cAdvisor + node-exporter for host and container telemetry

## Prerequisites

- Linux host with Docker Engine and Docker Compose
- Public DNS records for `APP_DOMAIN` and `RTC_DOMAIN`
- Firewall rules that allow:
  - `80/tcp` and `443/tcp` to Caddy
  - `443/udp` for HTTP/3 on Caddy
  - `7881/tcp` for LiveKit ICE/TCP fallback
  - `7882/udp` for LiveKit UDP mux
- A filled `.env.production` based on [.env.production.example](/C:/Users/vidhy/Desktop/meetings-app/.env.production.example:1)

## Deploy

1. Render the production configs:

```bash
npm run go-live:render
```

2. Start the production stack:

```bash
npm run go-live:up
```

3. Verify core services:

```bash
curl -f https://$APP_DOMAIN/api/health/ready
curl -f -H "Authorization: Bearer $METRICS_ACCESS_TOKEN" https://$APP_DOMAIN/api/metrics
```

4. Confirm operator surfaces:

- Grafana: `http://127.0.0.1:3001`
- Prometheus: `http://127.0.0.1:9090`
- Alertmanager: `http://127.0.0.1:9093`

Use SSH port forwarding rather than exposing those ports publicly.

## Alerting

The production rules in [alerts.production.yml](/C:/Users/vidhy/Desktop/meetings-app/ops/prometheus/alerts.production.yml:1) cover:

- host CPU saturation
- host memory saturation
- SFU join failure rate
- SFU packet loss
- app metrics scrape loss
- LiveKit metrics scrape loss

Alertmanager sends to `ALERT_WEBHOOK_URL` when configured.

## Capacity Guardrails

The current launch guardrails live in [guardrails.production.yml](/C:/Users/vidhy/Desktop/meetings-app/ops/capacity/guardrails.production.yml:1).

Use these as the operating envelope for v1:

- keep host CPU under 70% sustained; treat 85% as page-worthy
- keep host memory under 75% sustained; treat 85% as page-worthy
- keep LiveKit join failures under 2%; treat 5% as page-worthy
- keep packet loss under 1.5%; treat 3% as page-worthy
- cap single-room participants at 150 and plan events around 120
- cap active concurrent rooms at 20 and plan steady-state around 12

## Rollback

If production degrades:

1. Stop new scheduled large meetings.
2. Lower room load by ending overflow events or moving them off the host.
3. Roll back with:

```bash
npm run go-live:down
```

4. Bring the previous known-good stack back with the prior image/config bundle.
