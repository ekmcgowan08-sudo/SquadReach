/* Pilot QA, from the handoff: every desk screen lays out from 1180px up.
   At each width, the page doesn't scroll sideways, nothing spills past the
   window edge (except inside something that scrolls or clips on purpose),
   and the nav fades its right edge exactly when links are cut off. */
import { expect, test } from '@playwright/test';
import { as, ready } from './helpers';

const DESK = [
  '/planner', '/planner/prep', '/planner/prep?view=recap', '/planner/people', '/planner/roadmap', '/planner/roadmap?view=checks', '/planner/year', '/planner/season', '/planner/coverage',
  '/planner/liturgical', '/planner/live', '/planner/live?tab=run', '/planner/live?tab=results', '/planner/settings', '/planner/setup', '/planner/one-pager',
  '/console', '/console?tab=season', '/console?tab=teams', '/console?tab=scoring', '/console?tab=huddle', '/console?tab=reports', '/console?tab=people', '/console?tab=walkthrough'
];
const WIDTHS = [1180, 1280, 1440];

for (const width of WIDTHS)
  for (const path of DESK)
    test(path + ' at ' + width + 'px', async ({ page, context, baseURL }) => {
      await as(context, 'leader', baseURL!);
      await page.setViewportSize({ width, height: 820 });
      await page.goto(path);
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const issues = await page.evaluate(() => {
        const out: string[] = [];
        const root = document.scrollingElement ?? document.documentElement;
        const over = root.scrollWidth - root.clientWidth;
        if (over > 0) out.push('page scrolls sideways ' + over + 'px');
        const vw = window.innerWidth;
        const clipsX = (el: Element) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX);
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (!r.width || r.right <= vw + 1) continue;
          let p = el.parentElement;
          let held = false;
          while (p && p !== document.body) {
            if (clipsX(p)) {
              held = true;
              break;
            }
            p = p.parentElement;
          }
          if (!held) {
            out.push('spills past the window: <' + el.tagName.toLowerCase() + '> ' + Math.round(r.left) + '→' + Math.round(r.right) + ' “' + (el.textContent ?? '').trim().slice(0, 50) + '”');
            break;
          }
        }
        for (const nav of document.querySelectorAll('nav')) {
          const strip = [nav, ...nav.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowX === 'auto' && d.getBoundingClientRect().top < 70);
          if (!strip) continue;
          const clipped = strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 2;
          const cs = getComputedStyle(strip);
          const faded = (cs.maskImage || cs.webkitMaskImage || 'none') !== 'none';
          if (clipped && !faded) out.push((nav.getAttribute('aria-label') ?? 'nav') + ' is cut off without a fade');
          if (!clipped && faded) out.push((nav.getAttribute('aria-label') ?? 'nav') + ' fades though every link fits');
        }
        /* Buttons, chips and segmented options never wrap onto two lines:
           no run of text inside one breaks across lines. */
        for (const b of document.querySelectorAll('button, [role="tab"], [role="radio"]')) {
          if (!b.getBoundingClientRect().width || b.closest('[data-wraps]')) continue;
          const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          let wrapped = false;
          for (let n = walker.nextNode(); n && !wrapped; n = walker.nextNode()) {
            if (!(n.textContent ?? '').trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            const rects = [...range.getClientRects()].filter((x) => x.width > 1);
            const lh = parseFloat(getComputedStyle(n.parentElement!).fontSize);
            wrapped = rects.some((x) => Math.abs(x.top - rects[0].top) > lh * 0.6);
          }
          if (wrapped) {
            out.push('control wraps onto two lines: “' + (b.textContent ?? '').trim().slice(0, 50) + '”');
            break;
          }
        }
        return out;
      });
      expect(issues, path + ' at ' + width + 'px').toEqual([]);
    });
