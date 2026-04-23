import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? 'demo@zstream.app';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'Demo1234';

async function loginAsDemo(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.locator('#email').fill(DEMO_EMAIL);
  await page.locator('#password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in|signin/i }).click();
  await expect(page).toHaveURL(/\/meet$/, { timeout: 20_000 });
  await expect.poll(async () => {
    const response = await page.request.get('/api/auth/session');
    const body = await response.json().catch(() => null) as { user?: { email?: string } } | null;
    return body?.user?.email ?? null;
  }, { timeout: 20_000 }).toBe(DEMO_EMAIL);
}

test.describe('Meetings Core Smoke', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('health endpoint returns readiness payload', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data?.service).toBe('zmeetings-api');
    expect(['ok', 'degraded', 'down']).toContain(body.data?.status);
    expect(typeof body.data?.ready).toBe('boolean');
    expect(body.data?.checks?.auth?.status).toBeTruthy();
    expect(body.data?.checks?.database?.status).toBeTruthy();
    expect(body.data?.checks?.cache?.status).toBeTruthy();
  });

  test('login page renders and shows app framing', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await page.getByRole('button', { name: /create one for free/i }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole('link', { name: /terms of service/i }).click();
    await expect(page).toHaveURL(/\/terms-of-service$/);
  });

  test('join route redirects to attendee controls', async ({ page }) => {
    await page.goto('/meetings/join?meetingId=m1');
    await expect(page).toHaveURL(/\/meetings\/attendee\?meetingId=m1$/);
    await expect(page.getByRole('heading', { name: /get ready/i })).toBeVisible();
  });

  test('live meeting route asks unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/meetings/live?meetingId=m1');
    await expect(page.getByRole('heading', { name: /sign in required/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /sign in and join/i })).toBeVisible({ timeout: 15_000 });
  });

  test('live meeting route loads call controls', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/meetings/live?meetingId=m1');
    await expect(page.getByRole('button', { name: /mute mic|unmute mic/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /leave/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /enable captions/i }).click();
    await expect(page.getByText(/live captions enabled/i)).toBeVisible();

    await page.getByRole('button', { name: /raise hand/i }).click();
    await expect(page.getByText(/hand raised/i)).toBeVisible();

    await page.getByRole('button', { name: /expand quick controls/i }).click();
    await expect(page.getByRole('button', { name: /open invite card/i })).toBeVisible();
  });

  test('host meeting route controls respond to clicks', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/meetings/host?meetingId=m1');
    await expect(page.getByRole('heading', { name: /run the room with confidence/i })).toBeVisible();

    await page.getByRole('button', { name: /room controls/i }).click();
    await expect(page.getByRole('button', { name: /cameras off/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /mute all/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /lock room|unlock room/i })).toBeVisible();
    await page.getByRole('button', { name: /cameras off/i }).click();
    await expect(page.getByText(/applying camera-off command|all participant cameras turned off|unable to turn off all cameras/i)).toBeVisible();

    await page.getByRole('button', { name: /meeting tools/i }).click();
    await expect(page.getByRole('button', { name: /start recording|stop recording/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start transcript|stop transcript/i })).toBeVisible();
  });
});
