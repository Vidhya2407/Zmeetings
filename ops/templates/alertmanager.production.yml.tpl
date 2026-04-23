global:
  resolve_timeout: 5m

route:
  receiver: "primary"
  group_by: ["alertname"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 2h

receivers:
  - name: "primary"
{{ALERTMANAGER_PRIMARY_CONFIG}}
