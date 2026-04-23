# Meetings Live Validation

## Real SFU Validation

Use this checklist when `SFU_PROVIDER=livekit` is configured with real credentials.

1. Sign in as one host and at least two attendees in separate browsers.
2. Join the same meeting from all clients.
3. Verify host, attendee, and breakout rosters match the real participants.
4. Start a breakout with a non-zero countdown and confirm attendees auto-move after the timer ends.
5. Move one attendee to another breakout room and confirm the attendee is rerouted correctly.
6. Request host help from a breakout room and confirm the host sees and resolves the request.
7. Merge one room, then merge all rooms, and confirm all attendees rejoin the main room safely.
8. Refresh an attendee inside a breakout room and confirm reconnect returns them to the correct room.
9. Refresh the host page during an active breakout and confirm session state restores from the server.

## Production Validation

Use this checklist after deploying the single-region stack.

1. Confirm `/api/health`, `/api/health/ready`, and `/api/metrics` are healthy.
2. Confirm Prometheus is scraping app, node exporter, cAdvisor, and LiveKit metrics.
3. Confirm Grafana panels show join attempts, join failures, CPU, memory, and packet loss.
4. Run a live meeting with at least three browsers and watch telemetry during join, media publish, breakout split, and merge.
5. Force one attendee reconnect and confirm state recovery.
6. Validate alert routing by temporarily lowering one non-production threshold or using a synthetic alert rule.
7. Record safe concurrent capacity, peak CPU, peak memory, and packet loss under load for the release note.
8. Confirm logs, dashboards, and alerts are sufficient before enabling customer traffic.
