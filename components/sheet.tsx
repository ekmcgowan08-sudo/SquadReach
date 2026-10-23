'use client';
/* A bottom sheet over the phone. Focus moves into it on open.

   Sheets stack, and the two dismiss reflexes respect the stack:
   · Escape closes the top-most sheet only — one layer per press. Escape
     inside a field blurs the field instead; collapsing a form is a
     surprise, not a dismissal.
   · Browser Back (or the phone's back gesture) closes the top-most sheet
     instead of leaving the screen. Each open sheet holds one history entry;
     closing it any other way gives that entry back. */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayHost } from '@/lib/use-overlay-host';

type Layer = { id: number; close: () => void };
const layers: Layer[] = [];
let seq = 0;
/** history.back() calls we made ourselves, whose popstate we must not treat as a dismissal. */
let ownPops = 0;
let wired = false;

function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !layers.length) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        t.blur();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      layers[layers.length - 1].close();
    },
    true
  );
  window.addEventListener('popstate', () => {
    if (ownPops) {
      ownPops--;
      return;
    }
    const top = layers[layers.length - 1];
    if (top) {
      /* The browser already left this sheet's entry — don't hand it back again. */
      remove(top.id);
      top.close();
    }
  });
}

function remove(id: number) {
  const i = layers.findIndex((l) => l.id === id);
  if (i >= 0) layers.splice(i, 1);
}

const ourEntry = (id: number) => (window.history.state as { srSheet?: number } | null)?.srSheet === id;

export function Sheet({ open, onClose, label, children, z = 80, maxH = '88%' }: { open: boolean; onClose: () => void; label: string; children: ReactNode; z?: number; maxH?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const host = useOverlayHost();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    wire();
    const id = ++seq;
    layers.push({ id, close: () => closeRef.current() });
    /* Keep the router's own state on the entry so going back to it is a
       no-op for the router. */
    window.history.pushState({ ...(window.history.state ?? {}), srSheet: id }, '', window.location.href);
    ref.current?.focus();
    return () => {
      const stillOpen = layers.some((l) => l.id === id);
      remove(id);
      if (stillOpen && ourEntry(id)) {
        ownPops++;
        window.history.back();
      }
    };
  }, [open]);
  if (!open || !host) return null;
  return createPortal(
    <div className="absolute inset-0 flex items-end" style={{ zIndex: z, background: 'rgba(8,9,16,.72)', animation: 'sr-fade .18s both' }} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-3 overflow-auto rounded-t-[20px] bg-surface px-[18px] pt-[16.8px]"
        style={{ maxHeight: maxH, boxShadow: 'var(--shadow-lg)', paddingBottom: 'max(env(safe-area-inset-bottom), 34px)', animation: 'sr-sheet .26s cubic-bezier(.22,.85,.34,1) both' }}
      >
        <div className="h-1 w-[38px] flex-none self-center rounded-full bg-neutral-700" />
        {children}
      </div>
    </div>,
    host
  );
}
