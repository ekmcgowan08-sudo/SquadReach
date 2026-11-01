import type { BrowserContext, Page } from '@playwright/test';
import { DEMO_NIGHT, addDays, demoNightFor } from '@/lib/data/demo-week';

/** Demo mode: the role switcher is a cookie. */
export async function as(context: BrowserContext, role: 'leader' | 'owner' | 'scorekeeper' | 'coach' | 'captain' | 'member' | 'parent' | 'congregation', baseURL: string) {
  await context.addCookies([{ name: 'sr_role', value: role, url: baseURL }]);
}

/** Wait for the app to finish booting (the store hydrates on the client). */
export async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"][aria-label="Loading"]'));
}

/** A date written in the demo's seed, on the week the demo is on today
 *  (lib/data/demo-week keeps its week 9 on the coming Wednesday). */
export function demoDate(iso: string): string {
  return addDays(iso, Math.round((Date.parse(demoNightFor(Date.now())) - Date.parse(DEMO_NIGHT)) / 86_400_000));
}
const at = (iso: string) => new Date(iso + 'T00:00:00');
/** "Wed, Nov 4" */
export const shortDay = (iso: string) => at(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
/** "November 4" */
export const longDay = (iso: string) => at(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
/** The Wednesday the demo's week 9 is on today. */
export const demoNight = () => demoNightFor(Date.now());
