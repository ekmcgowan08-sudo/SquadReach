'use client';
import { useEffect } from 'react';

/** Registers public/sw.js. It is network-first and caches no pages: a stale
 *  score during a live event is worse than no offline support. Writes made
 *  without signal are the outbox's job, not the service worker's. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* The app works without it; it only adds the offline fallback page. */
    });
  }, []);
  return null;
}
