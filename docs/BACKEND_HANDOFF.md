# ZMeetings Backend Handoff

This document describes the current frontend pages, button behavior, concepts, and backend work needed to make the app production-live.

## Global Concepts

Authentication:
- Workspace pages require a signed-in user.
- Unauthorized API responses redirect to `/login?next=...`.
- Current roles are `user`, `creator`, and `admin`.
- Meeting roles are `host`, `cohost`, and `attendee`.

Theme and language:
- Every page must support light mode and dark mode.
- Every user-facing label should use translation keys in `locales/en/common.json` and `locales/de/common.json`.
- Dynamic backend messages should either return stable message codes or be mapped by frontend translation helpers.

Meeting timing:
- Scheduled meetings should not be joinable until 10 minutes before `startsAt`.
- Host/cohost/admin action label is `Start meeting`.
- Attendee action label is `Join meeting`.
- Before the 10-minute window, the action button is muted/disabled.
- At or after 10 minutes before start, or when status is `live`, the action turns green/enabled.
- Ended meetings must not be joinable.

Room lock concept:
- `Room open` means attendees can enter or request entry.
- `Close room` locks the room/waiting room for new attendees.
- `Open room` unlocks it.
- This uses room state, not meeting status.

Device controls concept:
- `Device controls` means camera, microphone, and screen share are controlled on the local device.
- It is not a backend room state.
- When SFU media is connected, the label changes to media-ready/live wording.

## Main Workspace Routes

### `/meet`

Purpose:
- Primary meeting hub.
- Create instant meetings, join by room code, view upcoming meetings, inspect selected meeting summary and action items.

Key buttons:
- `New meeting`: creates a meeting for the current user, starts it immediately, then opens `/meetings/live?meetingId=...`.
- `Join`: looks up a meeting by room code, then routes the user to attendee flow.
- Upcoming meeting item: selects the meeting and loads details.
- Selected meeting primary action:
  - Host/cohost/admin sees `Start meeting`.
  - Attendee sees `Join meeting`.
  - Disabled until 10 minutes before meeting start.
  - Enabled/green when join window opens or meeting is live.
- `Retry details` / `Retry now`: refetches meeting/weekly data after API failure.

Current frontend API dependencies:
- `GET /api/meetings`
- `POST /api/meetings`
- `PATCH /api/meetings/:meetingId`
- `GET /api/meetings/:meetingId`
- `GET /api/meetings/:meetingId/summary?lang=en|de`
- `GET /api/meetings/lookup?code=...`
- `GET /api/carbon/weekly?lang=en|de`

Backend work to make live:
- Persist meetings in production database.
- Create meeting using authenticated user as host.
- Generate unique room code.
- Enforce role-based visibility in `GET /api/meetings`.
- Enforce 10-minute join window on backend as well as frontend.
- `PATCH status=live` should only allow host/cohost/admin.
- Meeting summary should return real transcript/recording summary when available.
- Weekly carbon API should use real meeting impact data, not demo `carbonSavedKg`.

### `/meetings/host?meetingId=:id`

Purpose:
- Host studio and moderation view.
- Used by host/cohost/admin to control room access, attendee media, waiting queue, recordings/transcripts state, and breakouts.

Key buttons:
- `Enter Live Room`: opens `/meetings/live?meetingId=:id`.
- `Copy room code`: copies the full meeting room code.
- `Share`: uses browser share or copies host link.
- `Refresh` / sync: pulls latest room state.
- `Room Controls`: dropdown for room-level actions.
- `Lock room` / `Unlock room`: updates waiting room lock.
- `Cameras off`: turns participant cameras off.
- `Mute all`: mutes participant microphones.
- `Start recording` / `Stop recording`: currently room feature state only.
- `Start transcript` / `Stop transcript`: currently room feature state only.
- Waiting queue `Admit` / `Remove`: admits or removes waiting participants.
- Breakout controls: create rooms, assign participants, start rooms, broadcast, merge rooms.

Backend work to make live:
- Enforce host/cohost/admin authorization on every moderation route.
- Persist room lock, media states, waiting participants, room features.
- Connect recording to a real recorder service.
- Connect transcript to real speech-to-text service.
- Persist recording/transcript artifacts and emit activity notifications.
- Persist breakout sessions, room assignment, room leads, countdowns, merge state.
- Return stable errors for unauthorized, not found, room closed, etc.

### `/meetings/attendee?meetingId=:id`

Purpose:
- Attendee pre-join studio.
- Shows meeting details, device toggles, and join gate.

Key buttons:
- `Join meeting`: green/enabled only when meeting is live or within 10 minutes before start.
- Muted/disabled join button: shown before join window opens.
- Camera/Microphone/Screen share toggles: local pre-join preferences.
- `Back to meetings`: returns to `/meet`.
- `Open calendar`: opens `/calendar`.

Backend work to make live:
- Return meeting metadata for attendee preview.
- Enforce join window server-side.
- Respect room lock/waiting room state.
- Add attendee to meeting only when allowed.
- Pass pre-join media preferences into live-room session if needed.

### `/meetings/live?meetingId=:id`

Purpose:
- Main live meeting room for hosts and attendees.
- Handles media controls, room state, participant list, waiting queue, chat link, invite card, and breakouts.

Key buttons:
- Mic, Camera, Share: local media controls and room media state.
- Captions: local UI toggle unless backend transcription is connected.
- Hand: raises hand in main room.
- More: opens extra meeting options.
- Full screen: browser fullscreen/presentation state.
- Leave: returns to `/meet?meetingId=:id`.
- Info: opens meeting invite/details card.
- Chat: opens `/chat?meetingId=:id`.
- Apps: opens `/settings`.
- Host-only `Close room` / `Open room`: toggles room lock.
- Invite card `Copy invite`: copies attendee join link.
- Breakout host controls: split participants, start rooms, merge rooms.
- Breakout attendee controls: request host help or merge.

Important UI labels:
- `Meeting code ECO-XXXX-ZX...` must be fully visible.
- `Device controls` means local mic/camera/share device state.
- `Close room` / `Open room` are buttons, not status-only chips.

Current frontend API dependencies:
- `GET /api/meetings/:meetingId`
- `POST /api/meetings/:meetingId/participants`
- `DELETE /api/meetings/:meetingId/participants?userId=...`
- `GET /api/meetings/:meetingId/carbon`
- `POST /api/meetings/:meetingId/carbon`
- `GET /api/meetings/:meetingId/breakouts/current`
- `POST /api/meetings/:meetingId/breakouts/sessions`
- `POST /api/meetings/:meetingId/breakouts/sessions/:sessionId/actions`
- `GET /api/network/risk?meetingId=...`
- `GET /api/meetings/:meetingId/sfu/token`

Backend work to make live:
- Provide real SFU tokens and room names.
- Persist and broadcast participant presence.
- Persist room lock and waiting queue.
- Enforce room lock on participant join.
- Implement media state sync across participants.
- Implement captions/transcript backend if captions are meant to be real.
- Store and stream carbon telemetry by room.
- Persist breakout sessions and actions.
- Enforce host-only operations.
- Make network risk configurable by environment and safe for local/private IPs.

### `/meetings/join?meetingId=:id`

Purpose:
- Redirect route for invite links.

Behavior:
- Redirects to `/meetings/attendee?meetingId=:id`.

Backend work:
- No backend needed except preserving meeting id and validating on target page.

## Sustainability / Impact

### `/impact`

Purpose:
- Company-wide sustainability dashboard.
- Displays carbon emissions, water wastage, e-waste, estimated carbon credits, and meeting count.
- Project rows expand to show meeting impact breakdown and calculation logic.

Key interactions:
- Top cards are company totals from all company meetings.
- Project row `+`: opens project details.
- Project row `-`: closes project details.
- Meeting row `+`: opens calculation details.
- Estimated carbon credits `i`: shows Verra VCS explanation.

Calculation concepts:
- Carbon comes from `meeting.carbonSummary.totalKg` when available.
- If no tracked carbon exists, frontend estimates from participant minutes and usage profile.
- Water wastage uses liters per kg CO2.
- E-waste uses grams per kg CO2.
- Estimated carbon credits use `kg CO2 / 1000`, because 1 credit equals 1 tonne CO2e.
- Credits info text: eco-server delivery modeled at `28 g CO2/GB` vs standard streaming baseline `72 g CO2/GB`.

Current frontend API dependencies:
- `GET /api/impact/company`

Backend work to make live:
- Return all company meetings for impact dashboard.
- Add tenant/company boundary.
- Calculate and store carbon telemetry server-side.
- Decide whether estimates are generated backend-side or frontend-side.
- Return water, e-waste, and credits from backend if auditability is required.
- Add source flags: `tracked`, `estimated`, `verified`.
- Add Verra/VCS eligibility status separately from estimated credits.

## Communication Pages

### `/chat`

Purpose:
- Team chat and meeting coordination.
- Supports local file/photo/video attachments in UI.

Key buttons:
- Thread item: selects conversation.
- Attach button: selects local files/photos/videos.
- Remove attachment: removes selected local attachment.
- Send: posts message.
- Retry now: refetches chat data.

Current frontend API dependencies:
- `GET /api/chat/threads`
- `GET /api/chat/threads/:threadId/messages`
- `POST /api/chat/threads/:threadId/messages`

Backend work to make live:
- Persist threads and messages.
- Add real attachment upload endpoint.
- Store files in object storage.
- Return attachment metadata and signed download/view URLs.
- Add file size/type validation backend-side.
- Add virus scanning if production files are allowed.
- Add realtime delivery through WebSocket/SSE if needed.

### `/activity`

Purpose:
- Unified activity feed for mentions, meeting updates, invites, recordings, and system events.

Key buttons:
- Filter chips: all/unread/mentions.
- Open context: opens recording, chat, meeting, or activity target.
- Mark read: marks an item read.
- Mark all read: marks all visible/unread items read.

Current frontend API dependencies:
- `GET /api/activity`
- `POST /api/activity/:id/read`

Backend work to make live:
- Emit activity items from meeting, calendar, chat, recording, and impact events.
- Use stable message codes or localized payloads.
- Persist read state per user.
- Include related entity IDs and target route data.

### `/recordings`

Purpose:
- Recording library and recording detail viewer.

Key buttons:
- View recording: opens recording detail.
- All recordings: returns to library.
- Play/Pause: currently UI state unless real media URL exists.
- Open activity: routes to activity feed.

Current frontend API dependencies:
- `GET /api/activity`
- `GET /api/meetings/:meetingId`
- `GET /api/meetings/:meetingId/summary`

Backend work to make live:
- Produce and store real recordings.
- Return media URL, duration, transcript, summary, action items.
- Emit `meeting_recording_ready` activity.
- Secure recording access by meeting membership/role.

## Scheduling And People

### `/calendar`

Purpose:
- Schedule events and optionally link/create meeting rooms.

Key buttons:
- Schedule: opens schedule modal.
- Prev/Next: changes calendar month.
- Month/Week: switches calendar view.
- Event item: selects event.
- Open linked meeting: opens `/meet?meetingId=:id`.
- Cancel event: host/owner-only cancel with confirmation.
- Save event: creates event and optionally a linked meeting.

Current frontend API dependencies:
- `GET /api/events`
- `POST /api/events`
- `DELETE /api/events/:eventId`
- `GET /api/meetings`
- `GET /api/people`

Backend work to make live:
- Persist calendar events.
- Enforce owner-only cancellation.
- Link event to meeting when requested.
- Add invitees as meeting participants.
- Emit activity notifications to attendees.
- Add conflict detection if needed.

### `/people`

Purpose:
- People directory, presence, invite-to-meeting shortcuts, direct chat open.

Key buttons:
- Search/filter: frontend filtering.
- Invite/add to meeting: creates or uses meeting and adds user.
- Message/open chat: opens direct chat thread.
- Presence controls if available.

Current API dependencies:
- `GET /api/people`
- `POST /api/meetings`
- `POST /api/meetings/:meetingId/participants`
- `GET/POST /api/chat/threads`
- `PATCH /api/people/:userId/presence`

Backend work to make live:
- Persist workspace users.
- Implement presence updates and presence TTL.
- Implement direct chat thread creation.
- Enforce permissions for adding users to meetings.

## Settings And Account

### `/settings`

Purpose:
- User settings for notifications, appearance, language, privacy export, and security access.

Key buttons/toggles:
- Push notifications: local/app notification setting.
- Meeting impact alerts: controls recording-ready/impact notifications.
- Theme: light/dark selection.
- Language: EN/DE.
- Export account data: downloads user account JSON.
- Reset preferences: resets local preferences.
- Open security center: opens `/settings/security`.

Backend work to make live:
- Persist settings per user.
- Store notification preferences.
- Store language/theme preference if desired.
- Implement account export from backend data, not local state only.

### `/settings/security`

Purpose:
- Security center for 2FA, backup codes, trusted devices, password update, sessions.

Key buttons:
- Enable/disable 2FA.
- Verify 2FA code.
- Generate backup codes.
- Copy/download backup codes.
- Change password.
- Revoke session/device.

Current backend dependencies:
- `POST /api/account/password`
- Auth/password reset APIs.

Backend work to make live:
- Real 2FA secret generation and verification.
- Store hashed backup codes.
- Trusted device/session management.
- Password change with current-password validation.
- Audit logs for security events.

## Auth And Public Pages

### `/login`

Purpose:
- Sign in, demo/dev sign-in, route back through `next`.

Backend work:
- Production NextAuth provider/session hardening.
- Remove or gate demo/dev login in production.
- Rate limit login attempts.

### `/register`

Purpose:
- Create user account.

Backend work:
- Persist user profile.
- Validate email uniqueness.
- Email verification if required.
- Rate limit registration.

### `/forgot-password` and `/reset-password/:token`

Purpose:
- Password reset request and token reset flow.

Backend work:
- Generate secure expiring reset token.
- Send reset email.
- Validate token once.
- Rotate password hash and invalidate sessions if required.

### `/privacy-policy`, `/terms-of-service`, `/cookie-policy`

Purpose:
- Static legal pages.

Backend work:
- None, unless legal copy is CMS-managed.

## Backend Priority Checklist

1. Auth and authorization
- Production auth sessions.
- Role enforcement: admin/creator/host/cohost/attendee.
- Tenant/company scoping for all workspace data.

2. Meeting lifecycle
- Create, schedule, start, end meetings.
- Join-window enforcement: 10 minutes before start.
- Room lock/waiting room enforcement.
- Participant add/remove and presence.

3. Live media
- Real SFU token generation.
- Room connection lifecycle.
- Media state sync.
- Screen share support.

4. Chat and files
- Persistent threads/messages.
- Attachment upload, object storage, signed URLs.
- Backend file validation and security scanning.

5. Recording/transcript
- Real recording service.
- Speech-to-text transcript service.
- Summary/action item generation.
- Recording library data.

6. Carbon and impact
- Server-side carbon telemetry capture.
- Meeting carbon summaries.
- Company impact totals.
- Estimated credits with clear `estimated`, `verified`, and `issued` statuses.

7. Calendar/activity/notifications
- Event persistence.
- Meeting invite workflows.
- Activity feed events and read state.
- Notification preference enforcement.

8. Production readiness
- Replace mock/demo repositories with production data stores.
- Add API validation and error codes.
- Add rate limiting.
- Add audit logs for host/security actions.
- Add observability for meeting room sync, SFU, recording, and carbon jobs.

## Frontend Handoff Status

Completed frontend behavior:
- Main menu order and visibility.
- Light/dark mode support on handoff-critical meeting pages.
- EN/DE translation support for major workspace pages.
- Meeting code visibility in live room footer.
- Host room open/close is a real button.
- `Device controls` replaces unclear `Local controls`.
- New meeting create/start flow uses current authenticated user and checked backend response.
- Join/start buttons are role-aware and time-gated.
- Impact page displays company-wide totals and expandable calculations.
- Chat UI supports local attachment selection.

Known frontend limitations for backend team:
- Some features are UI/local state until backend services exist: recording, transcript, captions, some notification delivery, and chat attachments.
- Chat attachments are currently attached client-side to local message state after send; backend storage is still needed.
- Carbon credit values are estimates and should not be treated as issued credits.
- Browser screenshot QA was not rerun in this handoff pass because no dev server was running at audit time.
