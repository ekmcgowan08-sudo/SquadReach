/* The phone app, in demo mode: the screens a night runs on. */
import { expect, test } from '@playwright/test';
import { as, ready } from './helpers';

test('a coach’s points wait for approval; a scorekeeper’s post live', async ({ page, context, baseURL }) => {
  await as(context, 'coach', baseURL!);
  await page.goto('/dashboard/score');
  await ready(page);
  await expect(page.getByText('Posts go to the approval queue for a leader to review')).toBeVisible();
  await page.getByRole('button', { name: /^Yellow/ }).first().click();
  await page.getByRole('button', { name: /^General/ }).first().click();
  await page.getByRole('button', { name: /^\+\d/ }).first().click();
  await expect(page.getByRole('status').filter({ hasText: /→ Yellow\. Sent for approval\./ })).toBeVisible();

  await as(context, 'scorekeeper', baseURL!);
  await page.goto('/dashboard/score');
  await ready(page);
  await expect(page.getByText(/Posts land on the board immediately/)).toBeVisible();
});

test('a leader opens live ministry time; a student sees nothing until it starts', async ({ page, context, baseURL }) => {
  await as(context, 'leader', baseURL!);
  await page.goto('/dashboard/live');
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Run' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open · / })).toBeVisible();

  await as(context, 'member', baseURL!);
  await page.goto('/dashboard/live');
  await ready(page);
  await expect(page.getByText('Nothing live right now')).toBeVisible();
});

test('every role reaches its More menu without errors', async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const role of ['leader', 'coach', 'captain', 'member', 'parent'] as const) {
    await as(context, role, baseURL!);
    await page.goto('/dashboard/more');
    await ready(page);
    await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('a family’s private link shows their student without signing in', async ({ page }) => {
  await page.goto('/f/demo-reid-family');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Ellison/).first()).toBeVisible();
});

test('the public board shows standings by parent code', async ({ page }) => {
  await page.goto('/b/SR-9K42');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Yellow/).first()).toBeVisible();
});
