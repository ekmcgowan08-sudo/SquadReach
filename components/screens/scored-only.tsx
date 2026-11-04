'use client';
/* A screen that only means something with a leaderboard — the score pad,
   submitting points, races, the recap card. In a season of regular
   programming it says so instead of taking points nobody will see. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, Screen, ScreenHeader } from '@/components/ui';
import { canApprove } from '@/lib/permissions';
import { scoringOn } from '@/lib/season';
import { useApp } from '@/lib/store/provider';

export function ScoredOnly({ title, children }: { title: string; children: ReactNode }) {
  const config = useApp((s) => s.data.config);
  const persona = useApp((s) => s.membership.persona);
  if (scoringOn(config)) return <>{children}</>;
  return (
    <Screen label={title}>
      <ScreenHeader title={title} back="/dashboard/more" />
      <div role="status" className="sr-card flex items-start gap-[11px] px-[15px] py-[14px]">
        <Icon name="ph ph-calendar-blank" className="mt-[1px] flex-none text-[18px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-[1.3] text-neutral-100">No leaderboard this season</div>
          <div className="mt-1 text-[12px] leading-[1.5] text-neutral-400 text-pretty">
            {(config.seasonName || 'This season') + ' runs as regular programming, so there’s nothing to score. Huddles, the run sheet, attendance and follow-up work as usual.'}
          </div>
          {canApprove(persona) ? (
            <Link href="/console?tab=season" className="mt-2 inline-flex min-h-11 items-center text-[12px] font-medium text-accent-300">
              Make a season with points live in Console › Season builder
            </Link>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
