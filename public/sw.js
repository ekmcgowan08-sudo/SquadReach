/* SquadRise service worker.
   Network-first and it caches no pages: a stale score during a live event is
   worse than no offline support. It only keeps the offline page so a phone
   that loses signal mid-navigation lands somewhere useful. Points entered
   without signal are held by the app's outbox, not here. */
const CACHE = 'squadrise-shell-v2';
const OFFLINE = ['/offline.html', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html')));
});

/* A push from the ministry's server (lib/server/push.ts). What it says was
   decided by the database; this only shows it. */
self.addEventListener('push', (e) => {
  let p = {};
  try {
    p = e.data ? e.data.json() : {};
  } catch {
    p = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(p.title || 'SquadRise', {
      body: p.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: p.tag || undefined,
      data: { url: p.url || '/dashboard' }
    })
  );
});

/* Opening a notification goes where it points, in a window that is already
   open if there is one. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/dashboard', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((w) => 'focus' in w);
      if (!open) return self.clients.openWindow(url);
      /* A window this worker doesn't control can't be sent elsewhere; open
         the link instead. */
      return open.focus().then((w) => (w && w.url !== url ? w.navigate(url).catch(() => self.clients.openWindow(url)) : w));
    })
  );
});
