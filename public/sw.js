/* SquadRise service worker.
   Network-first and it caches no pages: a stale score during a live event is
   worse than no offline support. It only keeps the offline page so a phone
   that loses signal mid-navigation lands somewhere useful. Points entered
   without signal are held by the app's outbox, not here. */
const CACHE = 'squadrise-shell-v1';
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

/* Notifications from Settings → "Send a test" and any later pushes open the
   app, reusing a window that is already open. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/dashboard';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((w) => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
