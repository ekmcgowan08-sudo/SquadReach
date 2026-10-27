'use client';
/* CONSOLE · BIBLE & MEMORY — which memory drills students get, and in
   which weeks; how each student's Bible streak stands; and which
   translations can show their text. Drills are switched per week, and no
   week is ever left with nothing to practise. */
import Link from 'next/link';
import { Section, useSaveConfig } from '@/components/console/kit';
import { weeksLabel } from '@/components/console/challenges-tab';
import { cx } from '@/components/ui';
import { DRILLS, LICENSE_STATUS, drillsIn, type DrillId } from '@/lib/bible';
import { useApp, useAppApi } from '@/lib/store/provider';

export function BibleTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const c = d.config;
  const weeks = Array.from({ length: c.seasonWeeks }, (_, i) => i + 1);
  const dw = c.drillWeeks ?? {};

  /* Save one drill's weeks, unless it would leave a week with no drill at all. */
  const setDrill = (id: DrillId, next: number[] | null) => {
    const after = { ...dw };
    if (next) after[id] = next;
    else delete after[id];
    const empty = weeks.find((w) => !DRILLS.some((x) => !after[x.id] || after[x.id]!.includes(w)));
    if (empty) {
      api().say('Week ' + empty + ' would have no drill left. Keep at least one on.');
      return;
    }
    const label = DRILLS.find((x) => x.id === id)!.label;
    saveConfig({ drillWeeks: after }, label + ': ' + (next && !next.length ? 'off' : weeksLabel(next).toLowerCase()));
  };
  const toggleWeek = (id: DrillId, w: number) => {
    const on = new Set(dw[id] ?? weeks);
    if (on.has(w)) on.delete(w);
    else on.add(w);
    setDrill(id, on.size === weeks.length ? null : [...on].sort((a, b) => a - b));
  };

  const track = [...d.studentBadges].sort((a, b) => b.bibleStreak - a.bibleStreak);
  const tonight = drillsIn(c.drillWeeks, c.weekNumber).length;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Memory drills" sub={'Six ways to drill the week’s verse on the phone. Switch one off, or run it only in some weeks; every week keeps at least one. ' + tonight + ' of 6 run this week.'}>
        <div className="flex flex-col gap-3">
          {DRILLS.map((x) => {
            const w = dw[x.id];
            const off = !!w && !w.length;
            return (
              <div key={x.id} className={cx('flex flex-col gap-2 rounded-md border px-4 py-3', off ? 'border-neutral-800' : 'border-accent-700')} style={{ background: off ? undefined : 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}>
                <div className="flex items-center gap-3">
                  <label className="flex min-h-9 flex-1 items-center gap-3 text-[14px] font-medium text-neutral-100">
                    <input type="checkbox" checked={!off} onChange={(e) => setDrill(x.id, e.target.checked ? null : [])} />
                    {x.label}
                  </label>
                  <span className="text-[12px] text-neutral-400">{off ? 'Off' : weeksLabel(w)}</span>
                </div>
                <div className="flex flex-wrap gap-[6px]" role="group" aria-label={x.label + ' weeks'}>
                  <button onClick={() => setDrill(x.id, null)} aria-pressed={!w} className={cx('min-h-8 rounded-md border px-3 text-[12px]', !w ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                    All
                  </button>
                  {weeks.map((n) => {
                    const on = !w || w.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => toggleWeek(x.id, n)}
                        aria-pressed={on}
                        aria-label={x.label + ', week ' + n}
                        className={cx('min-h-8 min-w-8 rounded-md border px-2 text-[12px] tabular-nums', on ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-500', n === c.weekNumber && 'font-semibold')}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] leading-[1.5] text-neutral-500">
          The verse for each week is set in{' '}
          <Link href="/console?tab=setup" className="text-accent-300 underline underline-offset-2">
            Setup
          </Link>
          .
        </p>
      </Section>

      <Section title="Season memory track" sub="Each student’s running Bible streak: days in a row they’ve practised the verse. Leaders see that the work happened, never a score.">
        {!track.length ? <p className="text-[13px] text-neutral-500">Nobody has practised yet this season.</p> : null}
        {track.length ? (
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] text-[13px]">
            {['Student', 'Squad', 'Bible streak'].map((h) => (
              <span key={h} className="pb-2 text-[11.5px] font-medium uppercase tracking-[.08em] text-neutral-500">
                {h}
              </span>
            ))}
            {track.map((b) => (
              <div key={b.name} className="contents">
                <span className="flex min-h-10 items-center border-t border-divider text-neutral-100">{b.name}</span>
                <span className="flex min-h-10 items-center border-t border-divider text-neutral-300">{d.teams.find((t) => t.id === b.team)?.name ?? '—'}</span>
                <span className="flex min-h-10 items-center border-t border-divider text-neutral-300">
                  {Math.ceil(b.bibleStreak / 7)} wk ({b.bibleStreak} {b.bibleStreak === 1 ? 'day' : 'days'})
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="Translations & licensing" sub="Public-domain translations work out of the box. Modern ones need a license from their publisher, or a Bible text provider, before their full text can show in the app; until then students see the reference and a note.">
        <div className="flex flex-col gap-2">
          {Object.entries(LICENSE_STATUS).map(([v, status]) => {
            const free = status === 'Public domain';
            return (
              <div key={v} className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-800 px-4">
                <span className="flex-1 text-[14px] font-medium text-neutral-100">{v}</span>
                <span className={cx('rounded-[5px] px-2 py-[3px] text-[12px]', free ? 'bg-accent-800 text-accent-100' : 'border border-accent-600 text-accent-200')}>{status}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
