import type { BrowserContext, Page } from '@playwright/test';

/** Demo mode: the role switcher is a cookie. */
export async function as(context: BrowserContext, role: 'leader' | 'owner' | 'scorekeeper' | 'coach' | 'captain' | 'member' | 'parent' | 'congregation', baseURL: string) {
  await context.addCookies([{ name: 'sr_role', value: role, url: baseURL }]);
}

/** Wait for the app to finish booting (the store hydrates on the client). */
export async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"][aria-label="Loading"]'));
}
