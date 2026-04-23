import { expect, test, type APIResponse, type Page } from '@playwright/test';

const DEMO_PASSWORD = 'Demo1234';
const TEST_MEETING_ID = 'm1';
const FLOW_POLL_TIMEOUT_MS = 30_000;

const USERS = {
  u1: { email: 'sarah@zstream.app', name: 'Dr. Sarah Chen' },
  u2: { email: 'marcus@zstream.app', name: 'Marcus Webb' },
  u3: { email: 'amara@zstream.app', name: 'Amara Diallo' },
} as const;

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  success?: boolean;
};

type BreakoutAssignment = {
  participantId: string;
  roomId: string;
  roomName: string;
};

type BreakoutRoom = {
  id: string;
  name: string;
  position: number;
  status: 'open' | 'closing' | 'merged';
};

type BreakoutSession = {
  assignments: BreakoutAssignment[];
  assignmentsLocked: boolean;
  helpRequests: Array<{ participantId: string; roomId: string }>;
  latestAnnouncement: { type: string; message: string } | null;
  latestBroadcast: { message: string } | null;
  myHelpRequest: { participantId: string; roomId: string } | null;
  roomCount: number;
  rooms: BreakoutRoom[];
  sessionId: string;
  status: 'draft' | 'countdown' | 'active' | 'ended';
};

type BreakoutSessionPayload = {
  session: BreakoutSession | null;
};

type CarbonRoomPayload = {
  participants: Array<{ id: string }>;
};

function buildMeetingUrl(path: string, meetingId: string) {
  return `${path}?meetingId=${encodeURIComponent(meetingId)}`;
}

async function expectApiSuccess<T>(responsePromise: Promise<APIResponse>) {
  const response = await responsePromise;
  const body = await response.json() as ApiEnvelope<T>;
  expect(response.ok(), body.error ?? 'Expected API request to succeed.').toBe(true);
  expect(body.success, body.error ?? 'Expected successful API envelope.').toBe(true);
  expect(body.data).toBeTruthy();
  return body.data as T;
}

async function loginAs(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|signin/i }).click();
  await expect(page).toHaveURL(/\/meet$/, { timeout: 20_000 });
}

async function syncCarbonParticipants(
  page: Page,
  meetingId: string,
  participants: Array<{ id: string; displayName: string; role: string }>,
) {
  await expectApiSuccess(
    page.request.post(`/api/meetings/${encodeURIComponent(meetingId)}/carbon`, {
      data: {
        action: 'syncParticipants',
        participants: participants.map((participant) => ({
          ...participant,
          media: {
            camera: false,
            microphone: true,
            screenShare: false,
          },
        })),
        ownedParticipantIds: ['u1'],
      },
    }),
  );
}

async function getBreakoutSession(page: Page, meetingId: string, participantId?: string) {
  const suffix = participantId ? `?participantId=${encodeURIComponent(participantId)}` : '';
  const response = await page.request.get(
    `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/current${suffix}`,
  );
  const body = await response.json() as ApiEnvelope<BreakoutSessionPayload>;
  expect(response.ok(), body.error ?? 'Expected breakout session request to succeed.').toBe(true);
  expect(body.success, body.error ?? 'Expected successful breakout session payload.').toBe(true);
  return body.data?.session ?? null;
}

async function getCarbonRoom(page: Page, meetingId: string) {
  const response = await page.request.get(`/api/meetings/${encodeURIComponent(meetingId)}/carbon`);
  const body = await response.json() as ApiEnvelope<CarbonRoomPayload>;
  expect(response.ok(), body.error ?? 'Expected carbon room request to succeed.').toBe(true);
  expect(body.success, body.error ?? 'Expected successful carbon room payload.').toBe(true);
  return body.data as CarbonRoomPayload;
}

async function endBreakoutIfPresent(page: Page, meetingId: string) {
  const session = await getBreakoutSession(page, meetingId);
  if (!session || session.status === 'ended') {
    return;
  }

  await expectApiSuccess(
    page.request.post(
      `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/sessions/${encodeURIComponent(session.sessionId)}/actions`,
      {
        data: { action: 'end' },
      },
    ),
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(4);
}

test.describe('Meetings Breakout QA', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('host can create, split, move, broadcast, merge, and end breakout rooms', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    await loginAs(hostPage, USERS.u1.email);
    await endBreakoutIfPresent(hostPage, TEST_MEETING_ID);
    await syncCarbonParticipants(hostPage, TEST_MEETING_ID, [
      { id: 'u1', displayName: USERS.u1.name, role: 'Moderator' },
      { id: 'u2', displayName: USERS.u2.name, role: 'Attendee' },
      { id: 'u3', displayName: USERS.u3.name, role: 'Attendee' },
    ]);

    await hostPage.goto(buildMeetingUrl('/meetings/host', TEST_MEETING_ID));
    await expect(hostPage.getByRole('heading', { name: /run the room with confidence/i })).toBeVisible();
    await expect(hostPage.getByRole('heading', { name: /split, assign, and start room discussions/i })).toBeVisible();

    await hostPage.getByRole('spinbutton', { name: /room count/i }).fill('2');
    await hostPage.getByRole('button', { name: /create set/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.roomCount ?? 0, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(2);

    await hostPage.getByRole('button', { name: /auto assign/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.assignments.length ?? 0, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(2);

    const sessionAfterAssign = await getBreakoutSession(hostPage, TEST_MEETING_ID);
    expect(sessionAfterAssign).not.toBeNull();

    const marcusAssignment = sessionAfterAssign?.assignments.find((assignment) => assignment.participantId === 'u2');
    expect(marcusAssignment).toBeTruthy();

    const moveTargetRoom = sessionAfterAssign?.rooms.find((room) => room.id !== marcusAssignment?.roomId && room.status === 'open');
    expect(moveTargetRoom).toBeTruthy();
    if (!marcusAssignment || !moveTargetRoom) {
      throw new Error('Expected breakout assignments to be ready for manual move.');
    }

    await hostPage.getByRole('combobox', { name: /participant to assign/i }).selectOption({ label: USERS.u2.name });
    await hostPage.getByRole('combobox', { name: /breakout room assignment target/i }).selectOption({ label: moveTargetRoom.name });
    await hostPage.getByRole('button', { name: /assign selected participant/i }).click();

    await expect
      .poll(async () => {
        const session = await getBreakoutSession(hostPage, TEST_MEETING_ID);
        return session?.assignments.find((assignment) => assignment.participantId === 'u2')?.roomId ?? null;
      }, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(moveTargetRoom.id);

    await hostPage.getByRole('textbox', { name: /broadcast message/i }).fill('Wrap up in two minutes and capture one concrete decision.');
    await hostPage.getByRole('button', { name: /^broadcast$/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.latestBroadcast?.message ?? '', { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('Wrap up in two minutes and capture one concrete decision.');

    await hostPage.getByRole('spinbutton', { name: /breakout start countdown seconds/i }).fill('1');
    await hostPage.getByRole('button', { name: /start countdown/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.latestAnnouncement?.type ?? null, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('breakout.starting');

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.assignmentsLocked ?? false, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(true);

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.status ?? null, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('active');

    await hostPage.getByRole('spinbutton', { name: /merge countdown seconds/i }).fill('0');
    await hostPage.getByRole('button', { name: /merge this room|reschedule merge/i }).nth(moveTargetRoom.position - 1).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.latestAnnouncement?.type ?? null, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('breakout.merging');

    await expect
      .poll(async () => {
        const session = await getBreakoutSession(hostPage, TEST_MEETING_ID);
        return session?.rooms.find((room) => room.id === moveTargetRoom.id)?.status ?? null;
      }, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('merged');

    await hostPage.getByRole('button', { name: /end & merge back/i }).click();

    await expect
      .poll(async () => await getBreakoutSession(hostPage, TEST_MEETING_ID), { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBeNull();

    await hostContext.close();
  });

  test('host refresh and attendee reconnect both restore breakout state from the server', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    await loginAs(hostPage, USERS.u1.email);
    await endBreakoutIfPresent(hostPage, TEST_MEETING_ID);
    await syncCarbonParticipants(hostPage, TEST_MEETING_ID, [
      { id: 'u1', displayName: USERS.u1.name, role: 'Moderator' },
      { id: 'u2', displayName: USERS.u2.name, role: 'Attendee' },
    ]);

    await loginAs(attendeePage, USERS.u2.email);
    await attendeePage.goto(buildMeetingUrl('/meetings/live', TEST_MEETING_ID));
    await expect(attendeePage.getByRole('button', { name: /mute mic|unmute mic/i })).toBeVisible();

    await hostPage.goto(buildMeetingUrl('/meetings/host', TEST_MEETING_ID));
    await expect(hostPage.getByRole('heading', { name: /run the room with confidence/i })).toBeVisible();

    await expect
      .poll(async () => {
        const room = await getCarbonRoom(hostPage, TEST_MEETING_ID);
        return room.participants.some((participant) => participant.id === 'u2');
      }, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(true);

    await hostPage.getByRole('spinbutton', { name: /room count/i }).fill('1');
    await hostPage.getByRole('button', { name: /create set/i }).click();
    await hostPage.getByRole('button', { name: /auto assign/i }).click();
    await hostPage.getByRole('spinbutton', { name: /breakout start countdown seconds/i }).fill('0');
    await hostPage.getByRole('button', { name: /start countdown/i }).click();

    await expect
      .poll(async () => {
        const session = await getBreakoutSession(hostPage, TEST_MEETING_ID);
        if (session?.status !== 'active') {
          return null;
        }
        return session;
      }, { timeout: FLOW_POLL_TIMEOUT_MS })
      .not.toBeNull();

    const attendeeAssignment = (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.assignments.find((assignment) => assignment.participantId === 'u2');
    expect(attendeeAssignment).toBeTruthy();
    if (!attendeeAssignment) {
      throw new Error('Expected attendee assignment after breakout start.');
    }

    const breakoutSession = await getBreakoutSession(hostPage, TEST_MEETING_ID);
    expect(breakoutSession?.latestAnnouncement?.type).toBe('breakout.started');

    await expect
      .poll(async () => attendeePage.url(), { timeout: FLOW_POLL_TIMEOUT_MS })
      .toContain(`breakoutRoomId=${attendeeAssignment.roomId}`);

    await expect(attendeePage.getByRole('button', { name: /request host help/i })).toBeVisible();
    await attendeePage.getByRole('button', { name: /request host help/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.helpRequests.length ?? 0, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(1);

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID, 'u2'))?.myHelpRequest?.participantId ?? null, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('u2');

    await expect(hostPage.getByRole('button', { name: /resolve request/i })).toBeVisible();
    await hostPage.getByRole('button', { name: /resolve request/i }).click();

    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.helpRequests.length ?? 0, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe(0);

    await attendeePage.goto(buildMeetingUrl('/meetings/live', TEST_MEETING_ID));
    await expect
      .poll(async () => attendeePage.url(), { timeout: FLOW_POLL_TIMEOUT_MS })
      .toContain(`breakoutRoomId=${attendeeAssignment.roomId}`);

    await hostPage.reload();
    await expect(hostPage.getByRole('heading', { name: /split, assign, and start room discussions/i })).toBeVisible();
    await expect
      .poll(async () => (await getBreakoutSession(hostPage, TEST_MEETING_ID))?.status ?? null, { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBe('active');

    await hostPage.getByRole('button', { name: /end & merge back/i }).click();
    await expect
      .poll(async () => await getBreakoutSession(hostPage, TEST_MEETING_ID), { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBeNull();

    await expect
      .poll(async () => new URL(attendeePage.url()).searchParams.get('breakoutRoomId'), { timeout: FLOW_POLL_TIMEOUT_MS })
      .toBeNull();

    await hostContext.close();
    await attendeeContext.close();
  });

  test('host and attendee meeting surfaces stay usable on mobile without horizontal overflow', async ({ browser }) => {
    const mobileViewport = { width: 390, height: 844 };
    const hostContext = await browser.newContext({ viewport: mobileViewport });
    const attendeeContext = await browser.newContext({ viewport: mobileViewport });
    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    await loginAs(hostPage, USERS.u1.email);
    await endBreakoutIfPresent(hostPage, TEST_MEETING_ID);
    await syncCarbonParticipants(hostPage, TEST_MEETING_ID, [
      { id: 'u1', displayName: USERS.u1.name, role: 'Moderator' },
      { id: 'u2', displayName: USERS.u2.name, role: 'Attendee' },
    ]);

    await loginAs(attendeePage, USERS.u2.email);

    await hostPage.goto(buildMeetingUrl('/meetings/host', TEST_MEETING_ID));
    await expect(hostPage.getByRole('heading', { name: /run the room with confidence/i })).toBeVisible();
    await expect(hostPage.getByRole('heading', { name: /split, assign, and start room discussions/i })).toBeVisible();
    await expect(hostPage.getByRole('spinbutton', { name: /room count/i })).toBeVisible();
    await expect(hostPage.getByRole('button', { name: /create set/i })).toBeVisible();
    await expectNoHorizontalOverflow(hostPage);

    await attendeePage.goto(buildMeetingUrl('/meetings/live', TEST_MEETING_ID));
    await expect(attendeePage.getByRole('button', { name: /mute mic|unmute mic/i })).toBeVisible();
    await attendeePage.getByRole('button', { name: /expand quick controls/i }).click();
    await expect(attendeePage.getByRole('button', { name: /open invite card/i })).toBeVisible();
    await expectNoHorizontalOverflow(attendeePage);

    await hostContext.close();
    await attendeeContext.close();
  });
});
