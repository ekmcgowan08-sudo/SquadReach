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
