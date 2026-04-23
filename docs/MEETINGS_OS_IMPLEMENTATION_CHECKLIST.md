# Meetings OS Implementation Checklist

Goal: transform the current app into a cohesive Meetings OS (`Meet`, `Chat`, `People`, `Calendar`, `Activity`, `Settings`) aligned with the provided visual references.

## Progress Snapshot (2026-04-15)

### Completed
- Workspace shell is live with `AppShell`, desktop sidebar + mobile tabs, topbar, and shared routing via `app/(workspace)/layout.tsx`.
- Canonical workspace pages are live:
  - `/meet` -> `features/meet-workspace/screen.tsx`
  - `/chat` -> `features/chat-workspace/screen.tsx`
  - `/people` -> `features/people-workspace/screen.tsx`
  - `/calendar` -> `features/calendar-workspace/screen.tsx`
  - `/activity` -> `features/activity-workspace/screen.tsx`
- Meeting, chat, events, people, and activity APIs are wired to repositories that use MongoDB when available and fallback demo mode when DB is unavailable.
- Meeting domain service layer is now implemented:
  - `types/domain/meeting.ts`
  - `lib/meetings/meetingService.ts`
- Mongo-backed repositories exist for:
  - meetings (`lib/meetings/meetingRepository.ts`)
  - chat (`lib/chat/chatRepository.ts`)
  - events (`lib/events/eventRepository.ts`)
  - people (`lib/people/peopleRepository.ts`)
  - activity (`lib/activity/activityRepository.ts`)
- Activity <-> notifications sync is implemented through `NotificationCenter` + activity API read endpoints.
- Meeting lifecycle APIs now emit activity entries via service-layer hooks (create/update/start/end/join/leave).
- Reconnect/retry UX is implemented in Meet and Chat workspace screens, including session-expiry redirect handling.
- Security hardening already landed:
  - auth guard on write APIs
  - `Permissions-Policy` corrected for camera/mic `(self)`
  - production auth-secret check hardened for runtime only
- Validation baseline is green:
  - `npm run lint`
  - `npm run build`
  - `npx tsc --noEmit`
  - Playwright smoke: `Meetings Core Smoke` (3/3 passing)

### In Progress
- Legacy `/meetings/meetings/*` compatibility is now handled centrally via `next.config.js` redirects (filesystem duplicates removed).
- Core meeting UX is functional but still demo-level media/state (not yet SFU-backed realtime media plane).

### Pending / Missing For Production
- Real SFU media backend integration (LiveKit/mediasoup/Janus/Jitsi class) with robust signaling.
- Waiting room lock/admit/remove moderation at backend policy level (not only UI behavior).
- SSO (Google/Microsoft), stronger RBAC expansion (co-host/admin scopes), token/session hardening (rotation/revocation policy).
- Recording pipeline and storage lifecycle.
- Carbon module expansion for enterprise-grade rollups and methodology disclosures (company/project/user auditability).
- Observability stack (Sentry + metrics + tracing + alerting) and incident runbooks.
- Load, resilience, and degradation testing for concurrent rooms/participants.
- Security/compliance gates (automated vuln scanning, pentest, retention/deletion workflows, audit exports).

### Known Issues To Fix Next
- Add E2E coverage for:
  - chat -> create meeting -> join flow
  - people invite -> participant appears in meeting
  - calendar event -> open linked meeting

### Latest Cleanup Applied
- Removed duplicate feature tree `features/meetings/meetings/*` (canonical `features/meetings/*` retained).
- Removed duplicate filesystem routes under `app/meetings/meetings/*` and replaced them with `next.config.js` redirects.
- Removed legacy duplicate carbon API route file and redirected old API path in `next.config.js`:
  - `/api/meetings/meetings/:roomId/carbon` -> `/api/meetings/:roomId/carbon`
- De-duplicated carbon-room API logic into a shared module:
  - `lib/meetings/carbonRoomRoute.ts`
- Added backend health/readiness endpoint:
  - `app/api/health/route.ts` (auth/database/cache checks + readiness status)
- Added retry-capable client fetch utility:
  - `lib/api/fetchJsonWithRetry.ts`
- Completed repository migration for people + activity routes:
  - `app/api/people/route.ts`
  - `app/api/people/[userId]/presence/route.ts`
  - `app/api/activity/route.ts`
  - `app/api/activity/[id]/read/route.ts`

### Estimated Delivery Readiness (Current)
- Product flow completeness (MVP scope): ~80%
- Production hardening readiness: ~55%
- Enterprise go-live readiness: ~40%

## 0) Baseline Audit And Cleanup (Do First)

### 0.1 Route + Feature Duplication Cleanup
- [x] Remove duplicate route trees under `app/meetings/meetings/*` after migrating callers.
- [x] Keep one canonical feature tree: `features/meetings/*` and deprecate `features/meetings/meetings/*`.
- [x] Keep one canonical API for meeting carbon:
  - `app/api/meetings/[meetingId]/carbon/route.ts`
  - deprecate `app/api/meetings/meetings/[roomId]/carbon/route.ts`

### 0.2 Current UX/State Stabilization
- [x] Keep global lang/theme control in `components/layout/GlobalQuickControls.tsx`.
- [x] Ensure `documentElement` sync for:
  - `lang`
  - `data-theme`
- [x] Verify Tailwind content scanning remains valid in `tailwind.config.js`.

### 0.3 Definition Of Done
- [x] No duplicate `meetings/meetings` pages linked from nav.
- [x] No duplicate feature modules imported by active routes.
- [x] `npm run dev` loads canonical routes only.

---

## 1) Foundation Sprint (Global Workspace Shell)

### 1.1 New Shared Layout Components
- [x] Add `components/layout/AppShell.tsx`
- [x] Add `components/layout/WorkspaceSidebar.tsx`
- [x] Add `components/layout/WorkspaceTopbar.tsx`
- [x] Add `components/layout/WorkspaceContent.tsx`
- [x] Add `components/layout/PresenceChip.tsx`

### 1.2 Route Structure
- [x] Add route group: `app/(workspace)/layout.tsx`
- [x] Add pages:
  - `app/(workspace)/meet/page.tsx`
  - `app/(workspace)/chat/page.tsx`
  - `app/(workspace)/people/page.tsx`
  - `app/(workspace)/calendar/page.tsx`
  - `app/(workspace)/activity/page.tsx`
- [x] Add redirects:
  - `/meetings` -> `/meet` (temporary compatibility)
  - keep `/settings` as shared page

### 1.3 Shared State Contracts
- [x] Add `lib/stores/workspaceStore.ts`
  - active workspace tab
  - global search text
  - panel open/close state
- [x] Extend `lib/stores/notificationStore.ts`
  - source (`activity`, `chat`, `meeting`, `system`)
  - priority
  - linked entity id

### 1.4 Definition Of Done
- [x] Left rail + topbar visible across all workspace routes.
- [x] Consistent spacing/type scale across pages.
- [x] Mobile collapse behavior defined and tested.

---

## 2) Core Meeting Sprint (Meet + Room Lifecycle)

### 2.1 Meet Workspace
- [x] Add `features/meet-workspace/screen.tsx`
- [x] Add `features/meet-workspace/components/UpcomingMeetingsList.tsx`
- [x] Add `features/meet-workspace/components/QuickStartCard.tsx`
- [x] Add `features/meet-workspace/components/JoinByCodeCard.tsx`
- [x] Wire `app/(workspace)/meet/page.tsx` to `features/meet-workspace/screen.tsx`

### 2.2 Meeting Domain Model
- [x] Add `types/domain/meeting.ts`
  - `Room`, `Meeting`, `Participant`, `MeetingEvent`, `MeetingRole`
- [x] Add `lib/meetings/meetingService.ts`
  - create
  - join
  - leave
  - start
  - end

### 2.3 Meeting APIs
- [x] Add `app/api/meetings/route.ts` (`GET`, `POST`)
- [x] Add `app/api/meetings/[meetingId]/route.ts` (`GET`, `PATCH`)
- [x] Add `app/api/meetings/[meetingId]/participants/route.ts` (`POST`, `DELETE`)
- [x] Integrate existing carbon computation from:
  - `lib/meetings/carbonCalc.ts`
  - `hooks/useMeetingCarbonRoom.ts`

### 2.4 In-Call Controls Foundation
- [ ] Add `features/call-controls/ControlBar.tsx`
- [ ] Add `features/call-controls/ParticipantsPanel.tsx`
- [ ] Add `features/call-controls/InCallChatPanel.tsx`
- [ ] Add control actions:
  - mic/cam/screen
  - raise hand
  - leave meeting

### 2.5 Definition Of Done
- [x] Start/join/leave works end-to-end in UI.
- [x] Role permissions (host/cohost/attendee) enforced in UI state.
- [x] Meeting events emitted for Activity feed.

---

## 3) Collaboration Sprint (Chat + People + Calendar)

### 3.1 Chat Workspace
- [x] Add `features/chat-workspace/screen.tsx`
- [x] Add `features/chat-workspace/components/ThreadList.tsx`
- [x] Add `features/chat-workspace/components/MessagePane.tsx`
- [x] Add `features/chat-workspace/components/Composer.tsx`
- [x] Add stores:
  - `lib/stores/chatStore.ts`
- [x] Add APIs:
  - `app/api/chat/threads/route.ts`
  - `app/api/chat/threads/[threadId]/messages/route.ts`

### 3.2 People Workspace
- [x] Add `features/people-workspace/screen.tsx`
- [x] Add `features/people-workspace/components/DirectoryGrid.tsx`
- [x] Add `features/people-workspace/components/ContactCard.tsx`
- [x] Add APIs:
  - `app/api/people/route.ts`
  - `app/api/people/[userId]/presence/route.ts`

### 3.3 Calendar Workspace
- [x] Add `features/calendar-workspace/screen.tsx`
- [x] Add `features/calendar-workspace/components/MonthGrid.tsx`
- [x] Add `features/calendar-workspace/components/ScheduleModal.tsx`
- [x] Add `lib/stores/calendarStore.ts`
- [x] Add APIs:
  - `app/api/events/route.ts`
  - `app/api/events/[eventId]/route.ts`

### 3.4 Cross-Feature Flows
- [x] Chat thread -> create meeting with attendees.
- [x] People card -> invite to meeting/event.
- [x] Calendar event -> open meeting room state.

### 3.5 Definition Of Done
- [x] Chat threads with unread badges.
- [x] People search + quick actions.
- [x] Calendar schedule/update/delete working in UI.

---

## 4) Awareness Sprint (Activity + Notification Sync)

### 4.1 Activity Workspace
- [x] Add `features/activity-workspace/screen.tsx`
- [x] Add `features/activity-workspace/components/FeedFilters.tsx`
- [x] Add `features/activity-workspace/components/ActivityFeed.tsx`
- [x] Add store:
  - `lib/stores/activityStore.ts`

### 4.2 Unified Notifications
- [x] Sync `NotificationCenter` (`components/notifications/NotificationCenter.tsx`) with activity state.
- [x] Add read/unread parity between feed and popover.
- [x] Add priority sort:
  - meeting-now
  - mentions
  - direct chat
  - system

### 4.3 APIs
- [x] Add `app/api/activity/route.ts`
- [x] Add `app/api/activity/[id]/read/route.ts`

### 4.4 Definition Of Done
- [x] Activity feed drives notification popover.
- [x] Marking read in one place updates the other.

---

## 5) Differentiator Sprint (Carbon + Post-Meeting Intelligence)

### 5.1 Carbon Layer
- [ ] Add `features/carbon/components/MeetingCarbonCard.tsx`
- [ ] Add `features/carbon/components/WeeklyImpactCard.tsx`
- [ ] Add `features/carbon/components/CalendarOptimizationHint.tsx`
- [x] Add APIs:
  - `app/api/carbon/weekly/route.ts`
  - `app/api/carbon/meeting/[meetingId]/route.ts`

### 5.2 Post-Meeting Summary Layer
- [ ] Add `features/meeting-summary/components/SummaryCard.tsx`
- [ ] Add `features/meeting-summary/components/ActionItemsList.tsx`
- [x] Add placeholder APIs:
  - `app/api/meetings/[meetingId]/summary/route.ts`

### 5.3 Definition Of Done
- [ ] Per-meeting and weekly carbon cards visible in Meet + Activity.
- [ ] Post-meeting summary skeleton available after meeting end.

---

## 6) Hardening Sprint (Reliability, Security, QA)

### 6.1 Reliability
- [x] Add reconnect states and retry UX in meeting + chat pages.
- [ ] Add network quality indicator component.
- [x] Handle stale session and token expiry with graceful redirect.

### 6.2 Security
- [ ] Waiting room and meeting lock controls.
- [ ] Role-gated actions (host-only critical controls).
- [ ] Basic audit events for:
  - join/leave
  - role change
  - lock/unlock

### 6.3 QA + Accessibility
- [ ] Keyboard navigation for all primary actions.
- [ ] Focus states for left rail and workspace actions.
- [ ] Responsive checks for mobile/tablet/desktop.
- [ ] Add smoke specs:
  - login -> meet
  - schedule -> join
  - chat -> create meeting

### 6.4 Definition Of Done
- [ ] No critical regressions in core flows.
- [ ] Accessibility baseline passes.
- [ ] Performance baseline captured.

---

## MVP Cut (Ship First)

- [x] Global workspace shell and nav.
- [x] Meet, Chat, Calendar, People, Activity pages with working primary flows.
- [x] Start/join/schedule meeting.
- [x] Unread and activity sync.
- [x] Carbon meeting card + weekly card.

---

## Phase 2 (Post-MVP)

- [ ] Recording + transcript + search.
- [ ] AI summary + action extraction.
- [ ] Advanced moderation.
- [ ] External integrations (Google/Outlook/Slack).

---

## Execution Notes For This Repo

- Canonical root layout remains `app/layout.tsx`.
- Existing auth and security pages should be preserved:
  - `app/login/page.tsx`
  - `app/register/page.tsx`
  - `app/forgot-password/page.tsx`
  - `app/reset-password/[token]/page.tsx`
  - `app/settings/security/page.tsx`
- Existing stores to reuse/extend:
  - `lib/stores/themeStore.ts`
  - `lib/stores/languageStore.ts`
  - `lib/stores/settingsStore.ts`
  - `lib/stores/notificationStore.ts`
- Existing meeting carbon primitives to reuse:
  - `lib/meetings/carbonCalc.ts`
  - `hooks/useMeetingCarbonRoom.ts`
