'use client';
/* Standings — bar + category segments + trend. Home absorbed the old
   Scoreboard screen: tapping a row opens its category breakdown and trend.
   One screen, detail on demand. */
import { useMemo } from 'react';
import { deltaLabel, fmt, standingGaps, standings } from '@/lib/scoring';
import { useApp, useAppApi } from '@/lib/store/provider';

const TREND = [0.35, 0.45, 0.55, 0.62, 0.7, 0.78, 0.85, 0.92, 1];

export function useStandings() {
  const teams = useApp((s) => s.data.teams);
  const cats = useApp((s) => s.data.cats);
  const ledger = useApp((s) => s.data.ledger);
  return useMemo(() => standings(teams, cats, ledger), [teams, cats, ledger]);
}

export function StandingsCard() {
  const rows = useStandings();
  const gaps = useMemo(() => standingGaps(rows), [rows]);
  const open = useApp((s) => s.boardOpen);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();

  return (
    <div className="sr-card px-[15px] pb-[15px] pt-[14px]">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[14px] font-medium leading-none text-neutral-100">Live standings</div>
        {offline ? (
          /* A stale score is dangerous — say so rather than show a number that looks live. */
          <div className="rounded-full border border-accent-700 px-[7px] py-1 text-[9.5px] font-medium uppercase leading-none tracking-[.06em] text-accent-200">
            as of last signal
          </div>
        ) : (
          <div className="h-[6px] w-[6px] rounded-full bg-accent-400" style={{ boxShadow: '0 0 10px var(--color-accent-500)' }} />
        )}
        <div className="ml-auto text-[10.5px] leading-none text-neutral-500">tap a squad</div>
      </div>
      {gaps.length ? (
        <div className="mb-3 flex gap-[5.6px]">
          {gaps.map((g) => (
            <div key={g.label} className="flex-1 rounded-md bg-neutral-900 px-[10px] py-[9px]">
              <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">{g.label}</div>
              <div className="tabular mt-[5px] text-[15px] font-semibold leading-[1.1] text-neutral-100">{g.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-[2px]">
        {rows.map((t) => {
          const isOpen = open === t.id;
          return (
            <div key={t.id}>
              <button
                onClick={() => api().setBoardOpen(t.id)}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center gap-[10px] rounded-md px-1 text-left sr-hover"
              >
                <div className="w-[14px] flex-none text-[11px] font-semibold leading-none text-neutral-500">{t.rank}</div>
                <div className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: t.color }} />
                <div className="w-[74px] flex-none truncate text-[13px] font-medium leading-none text-neutral-200">{t.name}</div>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-neutral-900">
                  <div className="flex h-full" style={{ width: t.barPct + '%' }}>
                    {t.segs.map((s) => (
                      <div key={s.id} className="h-full" style={{ width: s.pct + '%', background: s.color }} />
                    ))}
                  </div>
                </div>
                <div className="tabular w-[46px] flex-none text-right text-[12.5px] font-semibold leading-none text-neutral-200">{fmt(t.total)}</div>
                <i aria-hidden="true" className={(isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down') + ' flex-none text-[12px] text-neutral-500'} />
              </button>
              {isOpen ? (
                <div className="px-1 pb-3 pl-[42px] pt-1 animate-sr-rise">
                  <div className="mb-[9px] text-[11px] leading-none" style={{ color: t.rank === 1 ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                    {deltaLabel(t)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-[6px]">
                    {t.segs.map((s) => (
                      <div key={s.id} className="flex items-center gap-[5px] text-[10.5px] leading-none text-neutral-500">
                        <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: s.color }} />
                        <span>
                          {s.label} <b className="font-semibold text-neutral-300">{fmt(s.value)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-[11px] flex h-[22px] items-end gap-[3px]" aria-hidden="true">
                    {TREND.map((f, i) => (
                      <div key={i} className="flex h-full flex-1 items-end">
                        <div className="w-full rounded-[1px] opacity-50" style={{ background: t.color, height: Math.round(f * 100) + '%' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The compact "Live now" list under the score pad. */
export function LiveNow() {
  const rows = useStandings();
  return (
    <div data-screen-label="Live Now" className="flex flex-col gap-3">
      <div className="mt-2 flex items-center gap-2">
        <i aria-hidden="true" className="ph ph-broadcast text-[14px] text-accent-300" />
        <span className="text-[10.5px] font-semibold uppercase leading-none tracking-[.13em] text-accent-300">Live now</span>
        <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,var(--color-neutral-800),transparent)' }} />
      </div>
      <div className="text-[10.5px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Standings</div>
      <div className="flex flex-col gap-[2px]">
        {rows.map((t) => (
          <div key={t.id} className="flex min-h-[23px] items-center gap-[10px]">
            <span className="w-[14px] text-[11px] text-neutral-500">{t.rank}</span>
            <span className="h-[9px] w-[9px] rounded-full" style={{ background: t.color }} />
            <span className="flex-1 text-[13px] text-neutral-200">{t.name}</span>
            <span className="tabular text-[13px] font-semibold text-neutral-200">{fmt(t.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
