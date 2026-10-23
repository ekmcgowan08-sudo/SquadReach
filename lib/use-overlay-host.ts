'use client';
import { useSyncExternalStore } from 'react';

/** The phone shell's overlay layer (#sr-overlay), once it exists. Full-bleed
 *  overlays portal here so they stay inside the phone column on a desk. */
export function useOverlayHost(): HTMLElement | null {
  return useSyncExternalStore(
    () => () => undefined,
    () => document.getElementById('sr-overlay'),
    () => null
  );
}
