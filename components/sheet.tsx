'use client';
/* A bottom sheet over the phone. Escape and the backdrop close it; focus
   moves into it on open. Escape inside a field blurs the field instead —
   collapsing a form is a surprise, not a dismissal. */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayHost } from '@/lib/use-overlay-host';

export function Sheet({ open, onClose, label, children, z = 80, maxH = '88%' }: { open: boolean; onClose: () => void; label: string; children: ReactNode; z?: number; maxH?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useOverlayHost();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        t.blur();
        return;
      }
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
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
