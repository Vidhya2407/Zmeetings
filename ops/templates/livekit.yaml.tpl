port: 7880
prometheus_port: 6789

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: {{LIVEKIT_USE_EXTERNAL_IP}}
{{LIVEKIT_NODE_IP_LINE}}

keys:
  {{LIVEKIT_API_KEY}}: {{LIVEKIT_API_SECRET}}

room:
  empty_timeout: 300
  departure_timeout: 20
  max_participants: {{LIVEKIT_ROOM_MAX_PARTICIPANTS}}

logging:
  level: info
