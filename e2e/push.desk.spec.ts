import { chromium, expect, test } from '@playwright/test';

/* The service worker shows what the server pushed. Delivered the way a push
   service would, through the DevTools protocol — in full Chromium, since the
   headless shell has no notifications at all. */
test('a push from the server shows as a notification that knows where it points', async ({ baseURL }) => {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const context = await browser.newContext({ permissions: ['notifications'] });
    const page = await context.newPage();
    await page.goto(baseURL + '/offline.html');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    });
    const cdp = await context.newCDPSession(page);
    const scope = new URL('/', baseURL).href;
    const registration = new Promise<string>((resolve) =>
      cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
        const r = e.registrations.find((x) => x.scopeURL === scope && !x.isDeleted);
        if (r) resolve(r.registrationId);
      })
    );
    await cdp.send('ServiceWorker.enable');
    const registrationId = await registration;
    const deliver = (data: string) => cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(scope).origin, registrationId, data });
    const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => [n.title, n.body, n.tag, (n.data as { url?: string })?.url]));

    await deliver(JSON.stringify({ title: 'Swap request', body: 'Coach Chris can’t do games on Wed, Nov 4', url: '/dashboard/serving', tag: 'nightCycle:p1' }));
    await expect.poll(shown).toEqual([['Swap request', 'Coach Chris can’t do games on Wed, Nov 4', 'nightCycle:p1', '/dashboard/serving']]);

    /* The same thing pushed again replaces it rather than stacking. */
    await deliver(JSON.stringify({ title: 'Swap request', body: 'Coach Chris can’t do games on Wed, Nov 11', url: '/dashboard/serving', tag: 'nightCycle:p1' }));
    await expect.poll(shown).toEqual([['Swap request', 'Coach Chris can’t do games on Wed, Nov 11', 'nightCycle:p1', '/dashboard/serving']]);
  } finally {
    await browser.close();
  }
});
