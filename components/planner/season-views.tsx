'use client';
/* PLANNER · SEASON & NIGHT, the two wider views. Season: what the season
   teaches, week by week, what runs alongside it, and how much of it is
   planned and debriefed. Month: every night in a month as a card — what it
   teaches, how full its plan is, who is still missing, and whether it was
   debriefed. A night opens the night view. */
import { useCycle } from '@/components/cycle/use-cycle';
import { Icon, cx } from '@/components/ui';
import { whoServes } from '@/lib/cycle';
import { addDays, weekdayOf } from '@/lib/liturgical';
import { MONTHS_FROM_AUG, inBlackout, laneColor, monthIndex, nightsOf, orderOf, teachingByNight, type PlanItem, type ResolvedSeason } from '@/lib/plan';

const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o);

export function SeasonOverview({ season, year, alongside, onNight }: { season: ResolvedSeason; year: number; alongside: PlanItem[]; onNight: (n: string) => void }) {
  const { d, today, iso: tonight } = useCycle();
  const p = d.plan;
  const teach = teachingByNight(p, year);
  const nights = season.nights;
  const arc = [...new Map(nights.filter((n) => teach[n]).map((n) => [teach[n].series.id, teach[n].series])).values()];
  const hue = (lane: string) => p.lanes.find((l) => l.id === lane)?.hue ?? 292;
  const taught = nights.filter((n) => teach[n]).length;
  const debriefed = nights.filter((n) => p.gatherings[n]?.debrief).length;
  const ran = nights.filter((n) => n < today).length;
  const stats = [
    { label: 'Gatherings', value: String(nights.length), hint: 'after breaks are removed' },
    { label: 'Planned', value: taught + ' of ' + nights.length, hint: 'have teaching attached' },
    { label: 'Debriefed', value: debriefed + ' of ' + ran, hint: ran ? 'of the nights that have run' : 'nothing has run yet' }
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-[640px]">
        <h2 className="text-[40px] font-medium leading-[1.05] tracking-[-.01em] text-neutral-100">{season.name}</h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-neutral-400 text-pretty">{season.note}</p>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-2">
          <div className="text-[11.5px] font-semibold uppercase tracking-[.12em] text-neutral-500">Teaching arc</div>
          {!arc.length ? <div className="text-[13px] text-neutral-500">Nothing scheduled to teach. Add a series on the roadmap.</div> : null}
          {arc.map((s) => {
            const mine = nights.filter((n) => teach[n]?.series.id === s.id);
            const color = laneColor(hue(s.lane));
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-md border border-neutral-800 bg-surface px-4 py-3" style={{ boxShadow: 'inset 3px 0 0 ' + color }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-neutral-100">
                    {s.title}
                    {s.status === 'draft' ? <span className="ml-2 text-[11.5px] font-normal text-neutral-500">draft</span> : null}
                  </div>
                  <div className="mt-[2px] text-[12.5px] text-neutral-400">
                    {(s.refs ? s.refs + ' · ' : '') + mine.length + ' of ' + s.size + ' weeks this season · ' + fmt(mine[0]) + ' – ' + fmt(mine[mine.length - 1])}
                  </div>
                </div>
                <div className="flex flex-none gap-[3px]">
                  {mine.map((n) => (
                    <button key={n} onClick={() => onNight(n)} title={fmt(n) + ' · week ' + teach[n].week} aria-label={'Open ' + fmt(n)} className="h-[18px] w-[7px] rounded-[2px]" style={{ background: color, opacity: n < today ? 1 : n === tonight ? 0.85 : 0.4 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((x) => (
              <div key={x.label} className="sr-card flex flex-col gap-1 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-400">{x.label}</div>
                <div className="tabular text-[24px] font-medium leading-tight text-neutral-100">{x.value}</div>
                <div className="text-[12px] leading-[1.35] text-neutral-400">{x.hint}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col">
            <div className="pb-2 text-[11.5px] font-semibold uppercase tracking-[.12em] text-neutral-500">Alongside the teaching</div>
            {!alongside.length ? <div className="text-[13px] text-neutral-500">Nothing else on the roadmap this season.</div> : null}
            {[...alongside].sort((a, b) => (a.month ?? 99) - (b.month ?? 99)).map((it) => (
              <div key={it.id} className="flex min-h-11 items-center gap-3 border-t border-divider">
                <span className="h-[14px] w-[3px] flex-none rounded-full" style={{ background: laneColor(hue(it.lane)) }} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-100">{it.title}</span>
                <span className="text-[12.5px] text-neutral-500">{it.month !== undefined ? MONTHS_FROM_AUG[it.month] : ''}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Ministry-year months (0 = August) that hold at least one night. */
export function monthsWithNights(nights: string[]): number[] {
  return [...new Set(nights.map(monthIndex))].sort((a, b) => a - b);
}

export function MonthView({ year, month, onNight }: { year: number; month: number; onNight: (n: string) => void }) {
  const { d, today, iso: tonight, nights: soon } = useCycle();
  const p = d.plan;
  const teach = teachingByNight(p, year);
  const nights = nightsOf(p, year).filter((n) => monthIndex(n) === month);
  const calYear = p.settings.startYear + year + (month >= 5 ? 1 : 0);
  const calMonth = ((month + 7) % 12) + 1;
  /* Every gathering weekday in the month, blackouts included, to say how many are in play. */
  const first = calYear + '-' + String(calMonth).padStart(2, '0') + '-01';
  const firstNight = addDays(first, (p.settings.gatherDay - weekdayOf(first) + 7) % 7);
  const dayName = new Date(firstNight + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  let day = firstNight;
  let all = 0;
  while (Number(day.slice(5, 7)) === calMonth) {
    all++;
    day = addDays(day, 7);
  }
  const roles = d.config.cycle.serveRoles;
  const hue = (lane: string) => p.lanes.find((l) => l.id === lane)?.hue ?? 292;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="flex-1 text-[40px] font-medium leading-[1.05] tracking-[-.01em] text-neutral-100">{new Date(first + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <span className="text-[13px] text-neutral-400">
          {nights.length} of {all} {dayName}s in play
          {all > nights.length ? ' · ' + (all - nights.length) + ' in a break' : ''}
        </span>
      </div>
      {!nights.length ? <div className="text-[13px] text-neutral-500">No gatherings this month{inBlackout(p, first) ? ' — it’s a break' : ''}.</div> : null}
      {nights.map((n) => {
        const t = teach[n];
        const g = p.gatherings[n];
        const order = orderOf(p, n);
        const mins = order.filter((b) => b.seg === 'main').reduce((x, b) => x + b.mins, 0);
        const open = soon.includes(n) ? roles.filter((r) => !whoServes(d, n, r)).length : null;
        const past = n < today;
        const color = t ? laneColor(hue(t.series.lane)) : 'var(--color-neutral-700)';
        const tags = [
          { label: order.length + ' blocks · ' + mins + ' min', strong: false },
          open != null ? { label: open ? open + (open === 1 ? ' role unfilled' : ' roles unfilled') : 'Every role filled', strong: open > 0 } : null,
          g?.live?.acts.length ? { label: g.live.acts.length + ' live ' + (g.live.acts.length === 1 ? 'activity' : 'activities'), strong: false } : null,
          past ? (g?.debrief ? { label: 'Debriefed', strong: false } : { label: 'Needs a debrief', strong: true }) : null
        ].filter((x): x is { label: string; strong: boolean } => !!x);
        return (
          <button key={n} data-wraps onClick={() => onNight(n)} className="sr-card flex flex-col gap-2 px-5 py-4 text-left transition-colors hover:border-accent-700" style={{ boxShadow: 'inset 3px 0 0 ' + color }}>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[17px] font-medium text-neutral-100">{fmt(n, { month: 'long', day: 'numeric' })}</span>
              <span className="text-[13px] text-neutral-500">{t ? t.series.title + ' · week ' + t.week : 'No teaching planned'}</span>
              {n === tonight ? <span className="rounded-full border border-accent-600 px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-[.1em] text-accent-200">{n === today ? 'Tonight' : 'Next'}</span> : null}
              <span className="flex-1" />
              <span className={cx('rounded-[5px] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[.08em]', g?.order ? 'bg-accent-800 text-accent-100' : 'bg-neutral-800 text-neutral-400')}>{g?.order ? 'Planned' : 'Template'}</span>
            </div>
            {t?.series.bigIdea ? <div className="text-[14.5px] text-neutral-200">{t.series.bigIdea}</div> : null}
            <div className="flex flex-wrap gap-2">
              {tags.map((x) => (
                <span key={x.label} className={cx('rounded-[5px] border px-2 py-[3px] text-[12px]', x.strong ? 'border-accent-600 text-accent-100' : 'border-neutral-700 text-neutral-400')}>
                  {x.label}
                </span>
              ))}
            </div>
          </button>
        );
      })}
      <div className="text-[12px] text-neutral-500">
        <Icon name="ph ph-info" className="mr-1 text-[13px]" />
        Who serves shows for the next {soon.length} {dayName}s, the stretch the schedule covers.
      </div>
    </div>
  );
}
