'use client';
/* How each season finished — recorded when the next season goes live, or
   by hand. The ledger carries on between seasons, so this is the record
   of where the board stood. */
import { Section, useSaveConfig } from '@/components/console/kit';
import { Btn } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { fmt } from '@/lib/scoring';
import { seasonResult, withResult } from '@/lib/season-results';
import { useApp, useAppApi } from '@/lib/store/provider';

export function PastSeasonsTable() {
  const results = useApp((s) => s.data.config.seasonResults) ?? [];
  if (!results.length) return <p className="text-[12.5px] text-neutral-500">No seasons recorded yet. The first one is recorded when the next season goes live.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[.1em] text-neutral-500">
            <th className="py-2 pr-4 font-semibold">Season</th>
            <th className="py-2 pr-4 font-semibold">Champion</th>
            <th className="py-2 pr-4 font-semibold">Top scorer</th>
            <th className="py-2 pr-4 font-semibold">Students</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name} className="border-t border-divider">
              <td className="py-2 pr-4 text-neutral-100">{r.name}</td>
              <td className="py-2 pr-4 text-neutral-300">
                {r.champion} <span className="tabular text-neutral-500">· {fmt(r.championPts)}</span>
              </td>
              <td className="py-2 pr-4 text-neutral-300">{r.topScorer ? r.topScorer + ' · ' + fmt(r.topPts) + ' pts' : '—'}</td>
              <td className="tabular py-2 pr-4 text-neutral-300">{r.students}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PastSeasons() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const save = useSaveConfig();
  const name = d.config.seasonName || 'This season';
  const recorded = (d.config.seasonResults ?? []).some((r) => r.name === name);
  const now = seasonResult(d, isoDay(new Date()));
  return (
    <Section title="Past seasons" sub="Champions and top scorers, season by season. When another season goes live, how this one finished is recorded first.">
      <div className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-[12.5px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
        <span className="flex-1 text-neutral-300">
          {name} as it stands: <span className="text-neutral-100">{now.champion}</span> leads with {fmt(now.championPts)}
          {now.topScorer ? '; ' + now.topScorer + ' tops the students with ' + fmt(now.topPts) : ''}.
        </span>
        <Btn
          variant="secondary"
          className="px-3 text-[12px]"
          onClick={() => {
            save((c) => ({ seasonResults: withResult(c.seasonResults, seasonResult(api().data, isoDay(new Date()))) }), (recorded ? 'Updated' : 'Recorded') + ' how ' + name + ' finished');
            api().say(name + ' is in Past seasons.');
          }}
        >
          {recorded ? 'Update the record' : 'Record how it finished'}
        </Btn>
      </div>
      <PastSeasonsTable />
    </Section>
  );
}
