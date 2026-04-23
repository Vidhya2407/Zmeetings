# Phase 2 SFU Media Integration (LiveKit)

This repository now includes a real SFU integration path for the main live meeting page:

- Secure meeting-scoped token endpoint
- LiveKit room connection from the client
- Real mic/camera/screen-share controls
- Participant join/leave/media updates from SFU room events
- Automatic fallback to existing demo media flow when SFU is not configured

## Added API

- `GET /api/meetings/[meetingId]/sfu/token`

Behavior:

1. Requires authenticated session.
2. Enforces meeting access via `resolveMeetingAuthorization`.
3. Returns LiveKit token payload when configured.
4. Returns `enabled=false` with reason when SFU is not configured.

## Environment Variables

Set these to enable real SFU media:

```env
SFU_PROVIDER=livekit
NEXT_PUBLIC_LIVEKIT_URL=wss://<your-livekit-host>
LIVEKIT_URL=wss://<your-livekit-host>
LIVEKIT_API_KEY=<your-key>
LIVEKIT_API_SECRET=<your-secret>
```

If these are missing, the app remains functional in demo fallback mode.

## Frontend Integration

Main room page:

- `app/meetings/live/page.tsx`

Client hook:

- `hooks/useMeetingSfuRoom.ts`

When SFU is connected:

1. Mic/camera/share buttons control real LiveKit tracks.
2. Participant count/list is sourced from SFU participants.
3. Track mute/unmute and participant connect/disconnect events immediately update UI.

When SFU is unavailable:

1. Existing carbon-room demo controls continue to work.
2. No interruption to current UX.

