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

test('More shows only rows whose screens the role can open', async ({ page, context, baseURL }) => {
  const more = async (role: 'member' | 'parent' | 'coach') => {
    await as(context, role, baseURL!);
    await page.goto('/dashboard/more');
    await ready(page);
    return page.locator('[data-screen-label="More menu"]');
  };
  let menu = await more('member');
  await expect(menu.getByRole('link', { name: /^Prayer Wall/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: /^Submit Points/ })).toHaveCount(0);
  menu = await more('parent');
  await expect(menu.getByRole('link', { name: /^Bible & Memory/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: /^Prayer/ })).toHaveCount(0);
  menu = await more('coach');
  await expect(menu.getByRole('link', { name: /^Prayer & Care/ })).toBeVisible();
  await menu.getByRole('link', { name: /^Submit Points/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/submit-points$/);
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

test('a leader reports another ministry’s library unit, and sees why theirs was reported', async ({ page, context, baseURL }) => {
  await as(context, 'leader', baseURL!);
  await page.goto('/dashboard/library');
  await ready(page);
  await page.getByRole('button', { name: /Invite Night/ }).click();
  await page.getByRole('button', { name: 'Report this unit' }).click();
  await page.getByRole('radio', { name: 'Not right for students' }).click();
  await page.getByRole('button', { name: 'Report it' }).click();
  await expect(page.getByText('Reported. It’s out of your library.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Invite Night/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Who do you text at 2am/ }).click();
  await expect(page.getByText(/one more report hides it/)).toBeVisible();
  await expect(page.getByText(/not for our sixth graders/)).toBeVisible();
});

test('Back walks the real way back, and More remembers recent screens', async ({ page, context, baseURL }) => {
  await as(context, 'leader', baseURL!);
  /* Loaded cold, a screen's Back goes to its parent. */
  await page.goto('/dashboard/library');
  await ready(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/dashboard\/more$/);
  /* Opened from inside the app, Back returns to whatever opened it. */
  await page.getByRole('link', { name: /^Calendar/ }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/calendar$/);
  await page.locator('a[href^="/dashboard/events/"]').first().click();
  await expect(page).toHaveURL(/\/dashboard\/events\//);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/dashboard\/calendar$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/dashboard\/more$/);
  /* Two deep screens visited: Recent shows them, survives a reload, and
     steps aside while searching. */
  const recent = page.getByText('Recent', { exact: true });
  await expect(recent).toBeVisible();
  await expect(page.getByRole('link', { name: 'Library' }).first()).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(recent).toBeVisible();
  await page.getByLabel('Search everything').fill('prayer');
  await expect(recent).toHaveCount(0);
});

test('a leader tours the app, previews a brand-new season, and resets the demo', async ({ page, context, baseURL }) => {
  await as(context, 'leader', baseURL!);
  await page.goto('/dashboard/more');
  await ready(page);
  await page.getByRole('button', { name: /^Leader tour/ }).click();
  const tour = page.getByRole('dialog', { name: 'Walkthrough' });
  await expect(tour).toContainText(/1 of \d+/);
  await tour.getByRole('button', { name: 'End the walkthrough' }).click();
  await expect(tour).toHaveCount(0);

  /* The blank ministry: no squads on the board, and More offers the way back. */
  await page.goto('/dashboard/more');
  await ready(page);
  await page.getByRole('button', { name: /^Preview a brand-new season/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await ready(page);
  await page.goto('/dashboard/score');
  await ready(page);
  await expect(page.getByRole('button', { name: /^Yellow/ })).toHaveCount(0);
  await page.goto('/dashboard/more');
  await ready(page);
  await expect(page.getByRole('button', { name: /^Preview a brand-new season/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Reset the demo/ }).click();
  await ready(page);
  await expect(page.getByRole('button', { name: /^Preview a brand-new season/ })).toBeVisible();
});

test('a small group screen starts from an idea, and its picture plays behind the words', async ({ page, context, baseURL }) => {
  await as(context, 'leader', baseURL!);
  await page.goto('/dashboard/season-plan?tab=groups');
  await ready(page);
  await page.getByRole('button', { name: 'New small group' }).click();
  const editor = page.getByRole('dialog', { name: 'Small group editor' });
  await editor.getByLabel('Title').fill('Week 9 · Courage');
  await editor.getByRole('group', { name: 'Add a screen' }).getByRole('button', { name: /Scripture/ }).click();
  await editor.getByRole('region', { name: 'Scripture ideas' }).getByRole('button', { name: /^Do not fear/ }).click();
  await expect(editor.getByLabel('Headline')).toHaveValue('Do not fear');
  await expect(editor.getByLabel('Reference')).toHaveValue('Joshua 1:9');
  await editor.getByRole('button', { name: 'Add a picture' }).click();
  await editor.getByLabel('Search pictures').fill('camp');
  await editor.getByRole('button', { name: 'Campfire circle' }).click();
  await editor.getByRole('group', { name: 'Where the picture goes' }).getByRole('button', { name: 'Behind' }).click();
  await expect(editor.getByText('Fade, so the words stay readable')).toBeVisible();
  await editor.getByRole('group', { name: 'Add a screen' }).getByRole('button', { name: /Prayer requests/ }).click();
  await editor.getByRole('button', { name: 'Start blank' }).click();
  await expect(editor.getByLabel('Headline')).toHaveCount(2);
  await editor.getByRole('button', { name: 'Save guide' }).click();
  await page.getByRole('button', { name: /^Play · 2/ }).last().click();
  const player = page.getByRole('dialog', { name: 'Week 9 · Courage' });
  await expect(player.getByText('Joshua 1:9')).toBeVisible();
  await expect(player.getByRole('img', { name: 'Campfire circle' })).toBeVisible();
});

test('a chat thread can be muted, left unread, or flagged for a leader who reads it', async ({ page, context, baseURL }) => {
  await as(context, 'member', baseURL!);
  await page.goto('/dashboard/chat?t=team-yellow');
  await ready(page);
  await page.getByRole('button', { name: 'Thread options' }).click();
  await page.getByRole('menuitem', { name: 'Mute this thread' }).click();
  await expect(page.getByText(/· muted$/)).toBeVisible();
  await page.getByRole('button', { name: 'Thread options' }).click();
  await page.getByRole('menuitem', { name: 'Mark unread' }).click();
  await expect(page).toHaveURL(/\/dashboard\/chat$/);
  /* Muted: it lists, but its unread never counts. */
  const row = page.getByRole('button', { name: /^Yellow Squad\s*,\s*muted/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('1', { exact: true })).toHaveCount(0);

  await row.click();
  await page.getByRole('button', { name: 'Thread options' }).click();
  await page.getByRole('menuitem', { name: 'Flag for a leader' }).click();
  await expect(page.getByText('You flagged this for a leader.', { exact: false })).toBeVisible();

  await as(context, 'leader', baseURL!);
  await page.goto('/dashboard/notifications');
  await ready(page);
  await page.getByRole('link', { name: /flagged the Yellow Squad thread/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/chat\?t=team-yellow/);
  const banner = page.getByRole('status').filter({ hasText: 'Flagged for a leader by' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Mark read' }).click();
  await expect(banner).toHaveCount(0);
});
