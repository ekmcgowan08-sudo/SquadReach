'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PushBanner, Ready, Toast } from '@/components/shell/phone-shell';
import { Icon } from '@/components/ui';
import { useApp } from '@/lib/store/provider';

export function ConsoleShell({ children }: { children: ReactNode }) {
  const name = useApp((s) => s.data.config.ministryName);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  return (
    <div className="relative min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-divider backdrop-blur-[10px]" style={{ background: 'color-mix(in srgb, var(--color-bg) 88%, #000)' }}>
        <div className="mx-auto flex max-w-[1080px] items-center gap-3 px-4 py-3">
          <div className="text-[14px] font-bold leading-none tracking-[-.01em] text-neutral-300">
            SQUAD<span className="text-accent-400">RISE</span>
          </div>
          <span className="text-neutral-700">/</span>
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-200">{name} · Console</div>
          {offline ? <span className="rounded-full border border-neutral-700 px-2 py-1 text-[10.5px] text-neutral-400">No signal — changes wait</span> : null}
          <Link href="/planner" className="hidden min-h-11 items-center gap-[6px] rounded-full border border-neutral-800 px-3 text-[12px] font-medium text-neutral-300 sm:flex">
            <Icon name="ph ph-map-trifold" className="text-[14px]" />
            Planner
          </Link>
          <Link href="/projector" className="hidden min-h-11 items-center gap-[6px] rounded-full border border-neutral-800 px-3 text-[12px] font-medium text-neutral-300 sm:flex">
            <Icon name="ph ph-monitor-play" className="text-[14px]" />
            Projector
          </Link>
          <Link href="/dashboard" className="flex min-h-11 items-center gap-[6px] rounded-full border border-accent-600 px-3 text-[12px] font-medium text-accent-200">
            <Icon name="ph ph-device-mobile" className="text-[14px]" />
            Open the app
          </Link>
        </div>
      </header>
      <PushBanner />
      <Ready>{children}</Ready>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] mx-auto h-[220px] max-w-[460px]">
        <Toast />
      </div>
      {/* Sheets open in a phone-width column, even on a desk. */}
      <div className="pointer-events-none fixed inset-0 z-[140] flex justify-center">
        <div id="sr-overlay" className="relative h-full w-full max-w-[560px] [&>*]:pointer-events-auto" />
      </div>
    </div>
  );
}
