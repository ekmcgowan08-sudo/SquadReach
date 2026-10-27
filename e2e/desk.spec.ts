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

test('People explains Planning Center in the demo, and the connect route says it isn’t set up', async ({ page }) => {
  await page.goto('/console?tab=people');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Planning Center' })).toBeVisible();
  await expect(page.getByText(/On the live app a leader connects the church’s Planning Center once/)).toBeVisible();
  await page.goto('/api/pco/connect');
  await expect(page).toHaveURL(/\/console\?tab=people&pco=unavailable$/);
});

test('Prep & recap turns to the recap once the night wraps, and the title turns it back', async ({ page }) => {
  await page.goto('/planner/prep');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prep week' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Preview as of' }).getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Follow-ups' })).toBeVisible();
  await expect(page.getByText('In the room', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();
  await page.getByRole('button', { name: 'Prep week' }).click();
  await expect(page).toHaveURL(/view=prep/);
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
});

test('People: approve a proposed swap, then take a paper slip on the Parents side', async ({ page }) => {
  await page.goto('/planner/people');
  await ready(page);
  await expect(page.getByRole('combobox', { name: 'Game lead on Wed, Nov 4' })).toHaveValue('Marcus Hall');
  await page.getByRole('button', { name: 'Approve · Jordan P. takes it' }).click();
  await expect(page.getByText('Marcus H. can’t do game lead')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Game lead on Wed, Nov 4' })).toHaveValue('Jordan Pike');

  await page.getByRole('button', { name: 'Parents', exact: true }).click();
  await expect(page).toHaveURL(/tab=parents/);
  await expect(page.getByText('2 of 6 signed')).toBeVisible();
  await page.getByRole('button', { name: 'Mark a paper slip for Isaac Smith' }).first().click();
  await expect(page.getByText('3 of 6 signed')).toBeVisible();
});

test('Season & night opens on the season, and a month card opens its night', async ({ page }) => {
  await page.goto('/planner/season');
  await ready(page);
  await expect(page.getByText('Teaching arc')).toBeVisible();
  await expect(page.getByText('Gatherings', { exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Month' }).click();
  await expect(page.getByText(/^\d+ of \d+ Wednesdays in play/)).toBeVisible();
  await page.getByRole('button', { name: /^October 21/ }).click();
  await expect(page).toHaveURL(/night=2026-10-21/);
  await expect(page.getByText('Service order')).toBeVisible();
});

test('Roadmap follows one class down the plan, a repeated grade taking two years', async ({ page }) => {
  await page.goto('/planner/roadmap?view=journey');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'The class of 2033' })).toBeVisible();
  await expect(page.getByText('7 years inside the plan · 6th through 12th')).toBeVisible();
  await page.getByText('Repeats a grade').locator('..').getByRole('button', { name: '8th' }).click();
  await expect(page.getByText('repeating 8th')).toBeVisible();
  await expect(page.getByText('7 years inside the plan · 6th through 11th')).toBeVisible();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByTitle('The class of 2033 is in 9th grade')).toBeVisible();
});

test('Ministry time: duplicate an activity, then turn the copy into a this-or-that', async ({ page }) => {
  await page.goto('/planner/live');
  await ready(page);
  await expect(page.getByText('Activities').locator('..').getByText('5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Activities').locator('..').getByText('6', { exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Activity' }).getByRole('button', { name: 'This or that' }).click();
  await expect(page.getByText('2. This or that')).toBeVisible();
  await expect(page.getByRole('textbox').first()).toHaveValue('Who wrote the letter to the Ephesians?');
});

test('the leader tour follows a new leader across the desk screens', async ({ page }) => {
  await page.goto('/planner/coverage');
  await ready(page);
  await page.getByRole('button', { name: 'Leader tour' }).click();
  await expect(page).toHaveURL(/\/planner$/);
  const tour = page.getByRole('dialog', { name: 'Leader tour' });
  await expect(tour).toContainText('1 of 13');
  await tour.getByRole('button', { name: /^Next: Fill roles/ }).click();
  await tour.getByRole('button', { name: 'Next: Prep week' }).click();
  await expect(page).toHaveURL(/\/planner\/prep\?view=prep$/);
  await expect(tour).toContainText('3 of 13');
  await page.reload();
  await ready(page);
  await expect(tour).toContainText('Prep week');
  await tour.getByRole('button', { name: 'End the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('⌘K’s debrief action opens tonight’s night, not the season', async ({ page }) => {
  await page.goto('/planner/season?debrief=1');
  await ready(page);
  await expect(page.getByText('Service order')).toBeVisible();
});

test('a challenge set up in the console runs on the phone only in its weeks', async ({ page }) => {
  await page.goto('/console?tab=challenges');
  await ready(page);
  await page.getByRole('button', { name: 'Add challenge' }).click();
  const card = page.getByRole('region', { name: 'Challenge: New challenge' });
  await card.getByLabel('Title').fill('Bring a parent night');
  await card.getByLabel('Title').press('Enter');
  const mine = page.getByRole('region', { name: 'Challenge: Bring a parent night' });
  await mine.getByRole('button', { name: 'None' }).click();
  await expect(mine.getByText('Runs: Paused')).toBeVisible();
  await page.goto('/dashboard/races');
  await ready(page);
  await expect(page.getByText('Bring a parent night')).toHaveCount(0);
  await page.goto('/console?tab=challenges');
  await ready(page);
  await page.getByRole('region', { name: 'Challenge: Bring a parent night' }).getByRole('button', { name: 'All' }).click();
  await page.goto('/dashboard/races');
  await ready(page);
  await expect(page.getByText('Bring a parent night')).toBeVisible();
});

test('a drill switched off in the console leaves the phone’s Bible screen', async ({ page }) => {
  await page.goto('/dashboard/bible');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Scramble', exact: true })).toBeVisible();
  await page.goto('/console?tab=bible');
  await ready(page);
  await page.getByRole('checkbox', { name: 'Scramble' }).uncheck();
  await expect(page.getByText('5 of 6 run this week.', { exact: false })).toBeVisible();
  await page.goto('/dashboard/bible');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Flashcards', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scramble', exact: true })).toHaveCount(0);
});

test('draft day puts one squad on the clock at a time, and a trade is kept in the history', async ({ page }) => {
  await page.goto('/console?tab=draft');
  await ready(page);
  await page.getByRole('button', { name: 'Start the draft' }).click();
  await expect(page.getByText('On the clock: Yellow')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft Marcus Webb on Red' })).toBeDisabled();
  await page.getByRole('button', { name: 'Draft Marcus Webb on Yellow' }).click();
  await expect(page.getByText('On the clock: Red')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Place Marcus Webb' })).toHaveCount(0);
  await page.getByRole('button', { name: 'End the draft' }).click();
  await expect(page.getByRole('button', { name: 'Start the draft' })).toBeVisible();

  await page.getByLabel('Student to trade').selectOption({ label: 'Marcus Webb' });
  await page.getByRole('button', { name: 'Confirm trade' }).click();
  await expect(page.getByText('Marcus Webb to Red')).toBeVisible();
});

test('the recording overlay settings move the scoreboard on the preview and stick', async ({ page }) => {
  await page.goto('/console?tab=overlay');
  await ready(page);
  await expect(page.getByRole('img', { name: /bottom, 100% size/ })).toBeVisible();
  await page.getByRole('group', { name: 'Where it sits' }).getByRole('button', { name: 'Top' }).click();
  await page.getByRole('checkbox', { name: 'Game clock' }).uncheck();
  await page.reload();
  await ready(page);
  await expect(page.getByRole('img', { name: /top, 100% size/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Game clock' })).not.toBeChecked();
});

test('the console opens on Home, and Export everything hands over one file', async ({ page }) => {
  await page.goto('/console');
  await ready(page);
  await expect(page.getByText(/You’re signed in as Ministry Leader at Grace Community Students/)).toBeVisible();
  await expect(page.getByText('Week 9 of 9')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^grace-community-students-\d{4}-\d{2}-\d{2}\.json$/);
});

test('media spots run in the weeks picked and show on the season plan', async ({ page }) => {
  await page.goto('/console?tab=media');
  await ready(page);
  await expect(page.getByRole('radiogroup', { name: 'Clips in the album' })).toBeVisible();
  await page.getByRole('button', { name: 'Add spot' }).click();
  const spot = page.getByRole('group', { name: 'Spot: Untitled' });
  await spot.getByLabel('Type', { exact: true }).fill('Sponsor read');
  await spot.getByLabel('Title', { exact: true }).fill('Pizza night thanks');
  await spot.getByLabel('Title', { exact: true }).press('Enter');
  const named = page.getByRole('group', { name: 'Spot: Pizza night thanks' });
  await named.getByRole('button', { name: 'None' }).click();
  await named.getByRole('button', { name: 'Pizza night thanks, week 9' }).click();
  await expect(named.getByText('Runs: Week 9')).toBeVisible();

  await page.goto('/dashboard/season-plan');
  await ready(page);
  await expect(page.getByText('Pizza night thanks')).toBeVisible();
  await expect(page.getByText('Blaze intro dance').first()).toBeVisible();

  await page.goto('/dashboard/media');
  await ready(page);
  const tonight = page.getByRole('region', { name: 'Tonight’s spots' });
  await expect(tonight.getByText('Pizza night thanks')).toBeVisible();
  await expect(tonight.getByText('Fall retreat promo')).toBeVisible();
});

test('an award voting window set in the console holds on the phone', async ({ page }) => {
  await page.goto('/console?tab=awards');
  await ready(page);
  const mvp = page.getByRole('group', { name: 'Award: MVP' });
  await expect(mvp.getByText(/^Open · closes after/)).toBeVisible();
  await mvp.getByLabel('Voting starts').fill('2099-01-01');
  await expect(mvp.getByText('Scheduled · starts Jan 1')).toBeVisible();

  await page.goto('/dashboard/awards');
  await ready(page);
  await expect(page.getByText('Voting hasn’t opened yet.')).toBeVisible();
  await expect(page.getByText(/Scheduled · starts Jan 1/)).toBeVisible();

  await page.goto('/console?tab=awards');
  await ready(page);
  await page.getByRole('group', { name: 'Award: MVP' }).getByRole('button', { name: 'Clear dates' }).click();
  await expect(page.getByRole('group', { name: 'Award: MVP' }).getByText('Open', { exact: true })).toBeVisible();
});

test('the console calendar approves a proposal and its event types reach the phone composer', async ({ page }) => {
  await page.goto('/console?tab=calendar');
  await ready(page);
  await page.getByRole('button', { name: 'Approve Reign bowling night' }).click();
  await expect(page.getByRole('button', { name: 'Approve Reign bowling night' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add event type' }).click();
  const type = page.getByRole('group', { name: 'Event type: New event' });
  await type.getByLabel('Name', { exact: true }).fill('Lock-in');
  await type.getByLabel('Name', { exact: true }).press('Enter');
  const lockIn = page.getByRole('group', { name: 'Event type: Lock-in' });
  await lockIn.getByLabel('Where', { exact: true }).fill('Fellowship hall');
  await lockIn.getByLabel('Where', { exact: true }).press('Enter');
  await expect(lockIn.getByLabel('Where', { exact: true })).toHaveValue('Fellowship hall');

  await page.goto('/dashboard/calendar');
  await ready(page);
  await page.getByRole('button', { name: /Event$/ }).click();
  await page.getByRole('button', { name: 'Lock-in' }).click();
  await expect(page.getByLabel('Event name')).toHaveValue('Lock-in');
  await expect(page.getByLabel('Where')).toHaveValue('Fellowship hall');
});

test('notification defaults set in the console are what a phone starts with', async ({ page }) => {
  await page.goto('/console?tab=notifs');
  await ready(page);
  await page.getByRole('checkbox', { name: /Weekly summary/ }).uncheck();
  await expect(page.getByText('9 of 10 on')).toBeVisible();

  await page.goto('/dashboard/notifications');
  await ready(page);
  await expect(page.getByText(/summary ready/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Notification settings' }).click();
  const weekly = page.getByRole('button', { name: /Weekly summary/ });
  await expect(weekly).toHaveAttribute('aria-pressed', 'false');
  await weekly.click();
  await expect(weekly).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back to the ministry’s settings' }).click();
  await expect(weekly).toHaveAttribute('aria-pressed', 'false');
});

test('console small groups: a template becomes a guide, and a guide for some squads hides from the rest', async ({ page, context, baseURL }) => {
  await page.goto('/console?tab=groups');
  await ready(page);
  await page.getByRole('button', { name: /^Icebreaker Night/ }).click();
  const editor = page.getByRole('region', { name: 'Small group editor' });
  await expect(editor.getByLabel('Title')).toHaveValue('Week 9 · Icebreaker Night');
  await editor.getByRole('button', { name: 'Save guide' }).click();
  await expect(page.getByRole('group', { name: 'Guide: Week 9 · Icebreaker Night' })).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate Week 8 · Handling pressure' }).click();
  await expect(page.getByRole('group', { name: 'Guide: Week 8 · Handling pressure (copy)' })).toBeVisible();
  await page.getByRole('button', { name: 'Save as template Week 8 · Handling pressure', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Handling pressure\s*3 screens/ })).toBeVisible();

  await page.getByRole('group', { name: 'Squads for Week 8 · Handling pressure', exact: true }).getByRole('button', { name: 'Red' }).click();
  await as(context, 'member', baseURL!);
  await page.goto('/dashboard/season-plan?tab=groups');
  await ready(page);
  await expect(page.getByText('Week 9 · Icebreaker Night')).toBeVisible();
  await expect(page.getByText('Week 8 · Handling pressure', { exact: true })).toHaveCount(0);
});

test('a lesson draft from Claude is reviewed before it saves, with a challenge per squad', async ({ page }) => {
  await page.route('**/api/small-groups/draft', (route) =>
    route.fulfill({
      json: {
        dropped: 1,
        challenges: [{ id: 'dc1', kind: 'Team', title: 'One good work nobody sees', body: 'Tell the squad next week.', pointsLabel: '', status: 'Not started', done: false, team: 'red', weeks: [9] }],
        group: { id: 'dg1', title: 'Made on purpose', notes: 'Split by grade.', weekNumber: 9, screens: [{ id: 'ds1', type: 'scripture', title: 'Read it', body: 'Read it aloud, one verse each.', ref: 'Ephesians 2:8–10' }] }
      }
    })
  );
  await page.goto('/console?tab=groups');
  await ready(page);
  await page.getByRole('button', { name: 'Passage only' }).click();
  await page.getByLabel('Passage').fill('Ephesians 2:1–10');
  await page.getByRole('button', { name: 'Generate draft' }).click();
  await expect(page.getByRole('heading', { name: 'Made on purpose' })).toBeVisible();
  await expect(page.getByText('One part broke the rules')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Guide: Made on purpose' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save the guide' }).click();
  await expect(page.getByRole('group', { name: 'Guide: Made on purpose' })).toBeVisible();
  await page.goto('/console?tab=challenges');
  await ready(page);
  await expect(page.locator('input[value="One good work nobody sees"]')).toBeVisible();
});

test('console access requests: change and approve as another role, or deny', async ({ page }) => {
  await page.goto('/console?tab=people');
  await ready(page);
  const chris = page.getByRole('group', { name: 'Request from Chris Sandoval' });
  await chris.getByLabel('Or assign Chris Sandoval as').selectOption({ label: 'Scorekeeper' });
  await chris.getByRole('button', { name: 'Change & approve Chris Sandoval as Scorekeeper' }).click();
  await expect(page.getByText('Scorekeeper (asked for Coach)')).toBeVisible();
  await page.getByRole('group', { name: 'Request from Renee Boyd' }).getByRole('button', { name: 'Deny Renee Boyd' }).click();
  await expect(page.getByText('Nothing pending right now.')).toBeVisible();
  await expect(page.getByText('Denied', { exact: true })).toBeVisible();

  await page.goto('/dashboard/audit');
  await ready(page);
  await page.getByRole('button', { name: /Activity/ }).click();
  await expect(page.getByText('Approved Chris Sandoval as Scorekeeper (asked for Coach)')).toBeVisible();
});

test('console live control sets off an effect on the room screen and edits the effect buttons', async ({ page }) => {
  await page.goto('/console?tab=live');
  await ready(page);
  await page.getByRole('group', { name: 'Effect', exact: true }).getByRole('button', { name: 'Freeze' }).click();
  await page.getByRole('group', { name: 'Used by', exact: true }).getByRole('button', { name: 'Red' }).click();
  await page.getByRole('group', { name: 'Applies to', exact: true }).getByRole('button', { name: 'Blue' }).click();
  await page.getByRole('button', { name: 'Trigger on screen' }).click();
  await expect(page.getByText('Freeze on Blue')).toBeVisible();

  const fog = page.getByRole('group', { name: 'Effect: Fog Out' });
  await fog.getByLabel('Name', { exact: true }).fill('Blackout');
  await fog.getByLabel('Name', { exact: true }).press('Enter');
  await expect(page.getByRole('group', { name: 'Effect: Blackout' })).toBeVisible();

  await page.goto('/projector');
  await ready(page);
  const banner = page.getByRole('status').filter({ hasText: 'Freeze' });
  await expect(banner).toContainText('on Blue');
  await expect(banner).toContainText('Red used it');
});

test('console student search opens a student’s card, and Edit on People finds them', async ({ page }) => {
  await page.goto('/console');
  await ready(page);
  await page.getByRole('combobox', { name: 'Search students by name' }).fill('ellison');
  await page.getByRole('option', { name: /Ellison Reid/ }).click();
  const card = page.getByRole('dialog', { name: 'Student: Ellison Reid' });
  await expect(card.getByText('Points this season')).toBeVisible();
  await expect(card.getByText('Recent points')).toBeVisible();
  await card.getByRole('link', { name: 'Edit on People' }).click();
  await expect(page).toHaveURL(/tab=people&q=Ellison/);
  await expect(page.getByLabel('Search the roster')).toHaveValue('Ellison Reid');
});

test('goal scoring: goals credited to a scorer, taken back, an MVP, and the room screen', async ({ page }) => {
  await page.goto('/console?tab=live');
  await ready(page);
  const goals = page.getByRole('region', { name: 'Goal scoring' });
  await goals.getByRole('button', { name: 'Off' }).click();
  await goals.getByRole('button', { name: 'Goal for Red' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log a goal' });
  await sheet.getByLabel('Who scored').selectOption({ index: 1 });
  const scorer = await sheet.getByLabel('Who scored').inputValue();
  await sheet.getByRole('button', { name: /Log the goal/ }).click();
  await expect(goals.getByLabel('Red goals')).toHaveText('1');
  await goals.getByRole('button', { name: 'Goal for Red' }).click();
  await page.getByRole('dialog', { name: 'Log a goal' }).getByRole('button', { name: /Log the goal/ }).click();
  await expect(goals.getByLabel('Red goals')).toHaveText('2');
  await goals.getByRole('button', { name: 'Take back Red’s last goal' }).click();
  await expect(goals.getByLabel('Red goals')).toHaveText('1');
  await goals.getByLabel('MVP of the game').selectOption(scorer);
  await goals.getByRole('button', { name: 'Name MVP' }).click();
  await expect(goals.getByText(scorer)).toBeVisible();

  await page.getByRole('combobox', { name: 'Search students by name' }).fill(scorer);
  await page.getByRole('option', { name: new RegExp(scorer) }).click();
  await expect(page.getByRole('dialog', { name: 'Student: ' + scorer }).getByText(/1 goal · 0 assists · MVP once/)).toBeVisible();

  await page.goto('/projector');
  await ready(page);
  await expect(page.getByLabel('Goals this game')).toBeVisible();
});

test('tournament bracket: seeded from the standings, winners advance and pay once, corrections start later rounds over', async ({ page }) => {
  await page.goto('/console?tab=scoring');
  await ready(page);
  const br = page.getByRole('region', { name: 'Tournament bracket' });
  await br.getByRole('button', { name: 'Turn on tournament mode' }).click();
  await br.getByRole('button', { name: 'Yellow wins semifinal match 1' }).click();
  await br.getByRole('button', { name: 'Blue wins semifinal match 2' }).click();
  await br.getByRole('button', { name: 'Yellow wins final match 1' }).click();
  await expect(br.getByText('Yellow wins the tournament')).toBeVisible();

  await page.goto('/projector');
  await ready(page);
  await expect(page.getByLabel('Tournament')).toContainText('Yellow wins the tournament');

  await page.goto('/console?tab=scoring');
  await ready(page);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('region', { name: 'Tournament bracket' }).getByRole('button', { name: 'Red wins semifinal match 1' }).click();
  await expect(page.getByText('Yellow wins the tournament')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tournament bracket' }).getByRole('button', { name: 'Red wins final match 1' })).toBeEnabled();
});

test('reports at a glance: views turn off and stay off, and a week shows its value on focus', async ({ page }) => {
  await page.goto('/console?tab=reports');
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Attendance over the season' })).toBeVisible();
  await page.getByRole('img', { name: /^Week 1: \d+%$/ }).focus();
  await expect(page.getByRole('tooltip')).toContainText('Week 1');
  await page.getByRole('group', { name: 'Views shown' }).getByRole('button', { name: 'Squad rosters' }).click();
  await expect(page.getByRole('heading', { name: 'Squad rosters' })).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Squad rosters' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Squad trends' })).toBeVisible();
});
