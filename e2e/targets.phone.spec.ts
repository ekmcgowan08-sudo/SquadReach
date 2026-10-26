/* Tap targets, from the handoff's accessibility walk: in a loud, dark gym
   with the phone at arm's length, every button and link is at least 44px
   tall. One reasoned exception — the words of the verse in the memory
   drill, which stay at WCAG 2.5.8's 24px so the verse still reads as a
   sentence. Links inside running text are exempt, as WCAG exempts them. */
import { expect, test, type Page } from '@playwright/test';
import { as, ready } from './helpers';

const LEADER = [
  '/dashboard', '/dashboard/score', '/dashboard/more', '/dashboard/live', '/dashboard/calendar', '/dashboard/chat', '/dashboard/bible', '/dashboard/night-recap', '/dashboard/prep-week',
  '/dashboard/serving', '/dashboard/parents', '/dashboard/door', '/dashboard/huddle', '/dashboard/games', '/dashboard/game-rules', '/dashboard/attendance', '/dashboard/approvals', '/dashboard/races',
  '/dashboard/awards', '/dashboard/badges', '/dashboard/library', '/dashboard/media', '/dashboard/notifications', '/dashboard/settings', '/dashboard/follow-ups', '/dashboard/season-plan',
  '/dashboard/walkthrough', '/dashboard/events', '/dashboard/audit', '/dashboard/access-requests', '/dashboard/recap', '/dashboard/submit-points', '/dashboard/parent-link', '/dashboard/team'
];
const OTHERS: [string, 'member' | 'parent' | 'coach' | 'captain' | null][] = [
  ['/dashboard', 'member'], ['/dashboard/live', 'member'], ['/dashboard/here', 'member'], ['/dashboard/bible', 'member'], ['/dashboard', 'parent'], ['/dashboard', 'coach'],
  ['/dashboard', 'captain'], ['/f/demo-reid-family', null], ['/b/SR-9K42', null], ['/login', null], ['/welcome', null]
];

async function small(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], select')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || el.closest('[aria-hidden="true"], [inert]')) continue;
      if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
      /* A link inside a sentence is part of the text. */
      if (el.tagName === 'A' && cs.display === 'inline' && (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 10) continue;
      const floor = el.closest('[data-drill-word]') ? 24 : 44;
      if (r.height < floor - 0.5) out.push(Math.round(r.height) + 'px “' + ((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) || el.tagName.toLowerCase()) + '”');
    }
    return out;
  });
}

for (const path of LEADER)
  test('tap targets are 44px on ' + path, async ({ page, context, baseURL }) => {
    await as(context, 'leader', baseURL!);
    await page.goto(path);
    await ready(page);
    expect(await small(page), path).toEqual([]);
  });

for (const [path, role] of OTHERS)
  test('tap targets are 44px on ' + path + ' (' + (role ?? 'public') + ')', async ({ page, context, baseURL }) => {
    if (role) await as(context, role, baseURL!);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (role) await ready(page);
    expect(await small(page), path).toEqual([]);
  });

/* The overlays the handoff never walked: the recorder, the small-group
   session player, the role sheet, and the sheets a leader opens most. */
const OVERLAYS: [string, string, (page: Page) => Promise<void>][] = [
  ['the recorder', '/dashboard/media?record=1', async () => {}],
  ['the small-group player', '/dashboard/season-plan?tab=groups', async (page) => page.getByRole('button', { name: /^Play/ }).first().click()],
  ['the role sheet', '/dashboard', async (page) => page.getByRole('button', { name: /Switch role/ }).first().click()],
  ['a library unit', '/dashboard/library', async (page) => page.getByRole('button', { name: /Invite Night/ }).click()],
  ['sharing to the library', '/dashboard/library', async (page) => page.getByRole('button', { name: 'Share ours' }).click()],
  ['the Tonight card, opened', '/dashboard', async (page) => page.getByRole('button', { name: /more and the ready check/ }).click()]
];
for (const [name, path, open] of OVERLAYS)
  test('tap targets are 44px in ' + name, async ({ page, context, baseURL }) => {
    await as(context, 'leader', baseURL!);
    await page.goto(path);
    await ready(page);
    await open(page);
    await page.waitForTimeout(500);
    expect(await small(page), name).toEqual([]);
  });
