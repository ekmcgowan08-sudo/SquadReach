/* The desk: the planner and the console, in demo mode. */
import { expect, test } from '@playwright/test';
import { as, ready } from './helpers';

test.beforeEach(async ({ context, baseURL }) => {
  await as(context, 'leader', baseURL!);
});

test('moving a roadmap item is one undo step', async ({ page }) => {
  await page.goto('/planner/roadmap');
  await ready(page);
  const chip = page.getByRole('button', { name: /Gospel of Mark/ }).first();
  const x0 = (await chip.boundingBox())!.x;
  await chip.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(async () => (await page.getByRole('button', { name: /Gospel of Mark/ }).first().boundingBox())!.x).toBeGreaterThan(x0);
  await expect(page.getByText(/^Saved on this device \d/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await page.getByRole('button', { name: /Gospel of Mark/ }).first().boundingBox())!.x).toBe(x0);
});

test('publishing shows exactly what changes, then nothing is left to publish', async ({ page }) => {
  await page.goto('/planner/roadmap?publish=1');
  await ready(page);
  const dialog = page.getByRole('dialog', { name: 'Publish the plan' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
});

test('the plan setup walks through to a saved plan', async ({ page }) => {
  await page.goto('/planner/setup');
  await ready(page);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Save the plan|Create the plan/ }).click();
  await expect(page.getByText('Setup complete')).toBeVisible();
});

test('live ministry time: open, answer, reveal — and the room screen follows', async ({ page, context }) => {
  await page.goto('/planner/live?tab=run');
  await ready(page);
  const [room] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Open the room screen' }).click()]);
  await room.waitForLoadState('networkidle');
  expect(new URL(room.url()).pathname).toBe('/live/room');
  /* The demo's room lives on this device, so there is no cast link to make. */
  await expect(page.getByRole('button', { name: 'Cast to a TV' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Open · / }).click();
  await page.getByRole('button', { name: /Paul/ }).last().click();
  await expect(page.getByText('Your answer')).toBeVisible();
  await expect(room.getByText('Who wrote the letter to the Ephesians?')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByText('Correct')).toBeVisible();
});

test('a cast link in the demo says where the room screen is instead', async ({ page }) => {
  await page.goto('/c/' + 'a'.repeat(64));
  await expect(page.getByText('Casting needs the live app')).toBeVisible();
});

test('coverage explains a cell, and a check can be set aside with a reason', async ({ page }) => {
  await page.goto('/planner/coverage');
  await ready(page);
  await page.getByRole('button', { name: /The Holy Spirit, class of 2031/ }).click();
  await expect(page.getByText(/doesn’t come up in any of their/)).toBeVisible();
  await page.goto('/planner/roadmap?view=checks');
  await ready(page);
  await page.getByRole('button', { name: 'Set aside…' }).first().click();
  await page.getByLabel('Reason').fill('Covered at the fall retreat');
  await page.getByRole('button', { name: 'Set aside', exact: true }).click();
  await expect(page.getByText(/Covered at the fall retreat/)).toBeVisible();
});

test('the console shows the delivery schedule and who can do what', async ({ page }) => {
  await page.goto('/console?tab=reports');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Delivery schedule' })).toBeVisible();
  await page.goto('/console?tab=people');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Who can do what' })).toBeVisible();
});

test('the one-pager renders for both audiences', async ({ page }) => {
  await page.goto('/planner/one-pager');
  await ready(page);
  await expect(page.getByText('Seven-year plan · for parents & students')).toBeVisible();
  await page.getByRole('button', { name: 'Elders & staff' }).click();
  await expect(page.getByText('Seven-year plan · for elders & staff')).toBeVisible();
});

test('pricing never reaches a ministry, not even its owner', async ({ page, context, baseURL }) => {
  await as(context, 'owner', baseURL!);
  const res = await page.goto('/vendor');
  expect(res?.status()).toBe(404);
  await page.goto('/console');
  await ready(page);
  await expect(page.getByText(/Plans & Billing|per student per year/)).toHaveCount(0);
});

test('on a touch screen, a roadmap chip is held, slid and lifted to move it', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
  await as(context, 'leader', baseURL!);
  const page = await context.newPage();
  await page.goto('/planner/roadmap');
  await ready(page);
  const chip = () => page.getByRole('button', { name: /Gospel of Mark/ }).first();
  const from = (await chip().boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const finger = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const x0 = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  await finger('touchStart', x0, y0);
  await page.waitForTimeout(550);
  for (let i = 1; i <= 8; i++) await finger('touchMove', x0 + (from.width + 30) * (i / 8), y0);
  await finger('touchEnd');
  await expect.poll(async () => (await chip().boundingBox())!.x).toBeGreaterThan(from.x + 40);
  /* Lifting the finger drops; it doesn't also open the item. */
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await chip().boundingBox())!.x).toBe(from.x);
  /* A tap a moment later still opens it (the lift's own click is the
     only one swallowed). */
  await page.waitForTimeout(400);
  await page.touchscreen.tap(x0, y0);
  await expect(page.getByRole('dialog', { name: /Gospel of Mark/ })).toBeVisible();
  await context.close();
});

test('on a touch screen, a ministry-year bar is held and slid to another month', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
  await as(context, 'leader', baseURL!);
  const page = await context.newPage();
  await page.goto('/planner/year');
  await ready(page);
  const bar = () => page.getByRole('button', { name: /^Fall kickoff/ }).first();
  const from = (await bar().boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const finger = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const x0 = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  await finger('touchStart', x0, y0);
  await page.waitForTimeout(550);
  for (let i = 1; i <= 8; i++) await finger('touchMove', x0 + (from.width + 6) * 2 * (i / 8), y0);
  await finger('touchEnd');
  await expect.poll(async () => (await bar().boundingBox())!.x).toBeGreaterThan(from.x + from.width);
  await context.close();
});

test('who-can-do-what prints on its own, chat scoping included', async ({ page }) => {
  await page.goto('/console?tab=people');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const sheet = page.locator('.sr-print-root');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Chat is scoped by tier, not by role')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Who can do what' })).toBeHidden();
});
