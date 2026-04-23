global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["prometheus:9090"]

  - job_name: "zmeetings-app"
    metrics_path: /api/metrics
    authorization:
      type: Bearer
      credentials: {{METRICS_ACCESS_TOKEN}}
    static_configs:
      - targets: ["app:3000"]

  - job_name: "livekit"
    metrics_path: /metrics
    static_configs:
      - targets: ["livekit:6789"]

  - job_name: "cadvisor"
    metrics_path: /metrics
    static_configs:
      - targets: ["cadvisor:8080"]

  - job_name: "node"
    metrics_path: /metrics
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: "alertmanager"
    metrics_path: /metrics
    static_configs:
      - targets: ["alertmanager:9093"]
