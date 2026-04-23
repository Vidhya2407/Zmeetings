{
  email {{LETSENCRYPT_EMAIL}}
}

{{APP_DOMAIN}} {
  encode gzip zstd
  reverse_proxy app:3000
}

{{RTC_DOMAIN}} {
  reverse_proxy livekit:7880
}
