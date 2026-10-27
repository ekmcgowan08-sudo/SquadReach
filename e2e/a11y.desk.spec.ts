/* Accessibility: axe on the screens people use most, phone and desk.
   Serious and critical findings fail the run. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { as, ready } from './helpers';

const PHONE = [
  '/dashboard', '/dashboard/score', '/dashboard/more', '/dashboard/live', '/dashboard/calendar', '/dashboard/chat', '/dashboard/bible', '/dashboard/night-recap', '/dashboard/prep-week',
  '/dashboard/serving', '/dashboard/parents', '/dashboard/door', '/dashboard/huddle', '/dashboard/games', '/dashboard/attendance', '/dashboard/approvals', '/dashboard/races', '/dashboard/awards',
  '/dashboard/library', '/dashboard/media', '/dashboard/notifications', '/dashboard/settings', '/dashboard/follow-ups', '/dashboard/season-plan', '/dashboard/walkthrough'
];
const DESK = [
  '/planner', '/planner/prep', '/planner/prep?view=recap', '/planner/people', '/planner/roadmap', '/planner/roadmap?view=journey', '/planner/roadmap?density=one', '/planner/roadmap?view=checks', '/planner/roadmap?view=suggestions', '/planner/year', '/planner/season', '/planner/season?view=month', '/planner/season?view=night', '/planner/coverage',
  '/planner/liturgical', '/planner/live', '/planner/live?tab=run', '/planner/settings', '/planner/setup', '/planner/one-pager', '/console', '/console?tab=season', '/console?tab=teams',
  '/console?tab=scoring', '/console?tab=challenges', '/console?tab=bible', '/console?tab=huddle', '/console?tab=reports', '/console?tab=people', '/console?tab=walkthrough', '/projector', '/live/room'
];

for (const path of [...PHONE, ...DESK]) {
  test('no serious accessibility problems on ' + path, async ({ page, context, baseURL }) => {
    await as(context, 'leader', baseURL!);
    if (PHONE.includes(path)) await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(path);
    await ready(page);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => v.id + ': ' + v.help + ' — ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')), path).toEqual([]);
  });
}

/* What students, parents and the public see. */
const OTHERS: [string, 'member' | 'parent' | null][] = [
  ['/dashboard', 'member'],
  ['/dashboard/live', 'member'],
  ['/dashboard/here', 'member'],
  ['/dashboard/bible', 'member'],
  ['/dashboard', 'parent'],
  ['/f/demo-reid-family', null],
  ['/b/SR-9K42', null],
  ['/login', null],
  ['/welcome', null]
];
for (const [path, role] of OTHERS) {
  test('no serious accessibility problems on ' + path + ' (' + (role ?? 'public') + ')', async ({ page, context, baseURL }) => {
    if (role) await as(context, role, baseURL!);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (role) await ready(page);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => v.id + ': ' + v.help + ' — ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')), path).toEqual([]);
  });
}
