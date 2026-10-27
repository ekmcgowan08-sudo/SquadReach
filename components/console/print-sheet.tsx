'use client';
/* On paper: only this sheet, landscape, dark ink on white — a copy that sits
   straight under <body> so nothing else on the page takes up a page. Mount
   one per screen; .sr-break starts a new sheet of paper. */
import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Btn, Icon } from '@/components/ui';

const noop = () => () => {};

export function PrintSheet({ title, children }: { title: string; children: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!client) return null;
  return createPortal(
    <div className="sr-print-root">
      <style>{`.sr-print-root { display: none } @media print { @page { size: landscape; margin: 12mm } html, body { background: #fff !important; color-scheme: light !important } body > :not(.sr-print-root) { display: none !important } .sr-print-root { display: block !important; color: #111 } .sr-print-root * { color: #111 !important; background: transparent !important; border-color: #bdbdbd !important } .sr-print-root .sr-break { break-before: page } .sr-print-root table { min-width: 0 !important } .sr-print-root tr { break-inside: avoid } .sr-print-root td, .sr-print-root th { padding-top: 2px !important; padding-bottom: 2px !important } .sr-print-root td div { font-size: 10.5px !important; line-height: 1.3 !important } }`}</style>
      <div className="mb-3 text-[16px] font-medium">{title}</div>
      {children}
    </div>,
    document.body
  );
}

export function PrintButton() {
  return (
    <Btn variant="secondary" className="px-4 text-[12.5px]" onClick={() => window.print()}>
      <Icon name="ph ph-printer" className="mr-[6px] text-[14px]" />
      Print
    </Btn>
  );
}
