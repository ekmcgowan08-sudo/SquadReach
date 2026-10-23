'use client';
import { useEffect, useState } from 'react';

/** The current time, re-read every `ms` while `active` — so a clock only
 *  costs renders while something on it is actually running. */
export function useNow(active: boolean, ms = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}
