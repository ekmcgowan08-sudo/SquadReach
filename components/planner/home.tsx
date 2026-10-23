'use client';
/* PLANNER · HOME — tonight at a glance from a desk: what is being taught,
   the plan of the night with who leads each block, who is serving, the
   ready check, what is waiting on you, and the students drifting away. */
import Link from 'next/link';
import { useMemo } from 'react';
import { useCycle } from '@/components/cycle/use-cycle';
import { Panel } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { clock, countdown, history, whoServes } from '@/lib/cycle';
import { isoDay } from '@/lib/dates';
import { clockOf, orderOf, orderTimes, seasonOfNight, teachingByNight, teachingOf, yearOf, yearLabel } from '@/lib/plan';
import { leaderNeeds, myCycleNeeds } from '@/lib/selectors';
import { useAppApi } from '@/lib/store/provider';

export function PlannerHome() {
  const { d, m, iso, t, now } = useCycle();
  const api = useAppApi();
  const p = d.plan;
  const y = yearOf(p, iso);
  const teach = teachingByNight(p, y)[iso];
  const season = seasonOfNight(p, iso);
  const order = orderTimes(orderOf(p, iso), d.config.cycle.setupAt);
  const cd = countdown(t, now);
  const needs = useMemo(() => [...leaderNeeds(d), ...myCycleNeeds(d, m, now)].filter((n) => !d.huddle.dismissed[n.id]), [d, m, now]);
  const h = d.huddle;
  const date = new Date(now);
  const greet = date.getHours() < 12 ? 'Good morning' : date.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const save = (recipe: (x: typeof h) => void) => {
    api().mutate((x) => recipe(x.huddle));
    api().emit({ kind: 'huddle', huddle: api().data.huddle });
  };
  const roles = d.config.cycle.serveRoles.map((r) => ({ role: r, who: whoServes(d, iso, r) }));
  /* Regulars who have missed two of the last three — the people to call. */
  const drifting = d.roster
    .filter((s) => !s.guest)
    .map((s) => ({ s, h: history(d, s.name, iso) }))
    .filter(({ h: hh }) => hh.length >= 4 && hh.filter(Boolean).length >= Math.ceil(hh.length / 2) && hh.slice(-3).filter(Boolean).length <= 1)
    .slice(0, 6);
  const y1 = teachingOf(p, 0);
  const drafts = p.items.filter((x) => x.status === 'draft').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[.12em] text-neutral-500">
            {d.config.ministryName} · {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="mt-1 text-[28px] font-medium leading-[1.15] text-neutral-100">
            {greet}, {m.firstName}.
          </h1>
          <div className="mt-1 text-[13px] text-neutral-400">
            {cd.phase === 'prep' ? cd.big + ' ' + cd.line : cd.line}
          </div>
        </div>
        <div className="tabular text-[13px] text-neutral-500">{clock(now)}</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="sr-dark relative overflow-hidden rounded-lg px-5 py-5" style={{ background: 'linear-gradient(160deg,var(--color-section) 0%,#1d2044 70%)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.12em] text-accent-300">
              {iso === isoDay(date) ? 'Tonight' : new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {season ? <span className="text-neutral-500">· {season.name}</span> : null}
              {teach ? (
                <span className="rounded-full border border-accent-600 px-2 py-[2px] text-accent-200">
                  {teach.series.title} · week {teach.week} of {teach.of}
                </span>
              ) : null}
            </div>
            <div className="text-[22px] font-medium leading-[1.2] text-neutral-100 text-pretty">{teach?.series.bigIdea || d.config.gameName || 'Nothing planned to teach'}</div>
            <div className="flex flex-col">
              {order.map((b) => (
                <div key={b.id} className={cx('grid grid-cols-[64px_1fr_auto] items-center gap-3 border-t border-white/10 py-[7px]', b.seg !== 'main' && 'opacity-60')}>
                  <span className="tabular text-[12px] text-neutral-400">{clockOf(b.start)}</span>
                  <span className="text-[13px] text-neutral-100">
                    {b.kind}
                    {b.title ? <span className="text-neutral-400"> · {b.title}</span> : null}
                  </span>
                  <span className="text-[11.5px] text-neutral-400">{b.lead ?? 'Everyone'}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn className="px-4" href="/dashboard/huddle">
                Run the huddle
              </Btn>
              <Btn variant="secondary" className="px-4" href={'/planner/season?night=' + iso}>
                Edit this night
              </Btn>
              <Btn variant="ghost" className="px-4" href="/projector">
                <Icon name="ph ph-monitor-play" className="mr-[6px] text-[14px]" />
                Projector
              </Btn>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Who’s on" meta={roles.filter((r) => r.who).length + ' of ' + roles.length + ' filled'} right={<Link href="/planner/people" className="text-[12px] text-accent-300">Schedule</Link>}>
            <div className="flex flex-col">
              {roles.map((r) => (
                <div key={r.role} className="flex items-center gap-3 border-t border-divider py-[7px] first:border-t-0">
                  <span className="w-[110px] flex-none text-[12px] text-neutral-500">{r.role}</span>
                  <span className="flex-1 text-[13px]" style={{ color: r.who ? 'var(--color-neutral-100)' : 'var(--color-accent-300)' }}>
                    {r.who ?? 'Open — fill it'}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Ready check" meta={h.ready.filter((r) => r.done).length + ' of ' + h.ready.length}>
            <div className="flex flex-col">
              {h.ready.map((r) => (
                <button
                  key={r.id}
                  onClick={() => save((x) => void (x.ready = x.ready.map((y) => (y.id === r.id ? { ...y, done: !y.done } : y))))}
                  aria-pressed={r.done}
                  className="flex min-h-10 items-center gap-3 border-t border-divider text-left first:border-t-0"
                >
                  <Icon name={r.done ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[17px]" style={{ color: r.done ? 'var(--color-accent-300)' : 'var(--color-neutral-600)' }} />
                  <span className="flex-1 text-[13px]" style={{ color: r.done ? 'var(--color-neutral-500)' : 'var(--color-neutral-100)', textDecoration: r.done ? 'line-through' : 'none' }}>
                    {r.label}
                  </span>
                  <span className="text-[11px] text-neutral-500">{r.who}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Needs you" meta={needs.length ? needs.length + ' open' : ''} className="lg:col-span-2">
          {!needs.length ? <div className="text-[12.5px] text-neutral-500">Nothing waiting on you.</div> : null}
          <div className="grid gap-2 md:grid-cols-2">
            {needs.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-md border border-neutral-800 px-3 py-[10px]">
                <Icon name={'ph ' + n.icon} className="mt-[1px] text-[16px] text-accent-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-[1.3] text-neutral-100">{n.title}</div>
                  <div className="mt-[2px] text-[11.5px] leading-[1.45] text-neutral-500 text-pretty">{n.meta}</div>
                  <div className="mt-2 flex gap-3">
                    <Link href={n.href.startsWith('/dashboard/serving') ? '/planner/people' : n.href.startsWith('/dashboard/parents') ? '/planner/people?tab=parents' : n.href.startsWith('/dashboard/night-recap') ? '/planner/prep' : n.href} className="text-[12px] font-medium text-accent-300">
                      Open
                    </Link>
                    <button onClick={() => save((x) => void (x.dismissed[n.id] = true))} className="text-[12px] text-neutral-500">
                      Mark done
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title="Bring them back" meta="missed two of the last three">
            {!drifting.length ? <div className="text-[12.5px] text-neutral-500">Nobody regular is drifting right now.</div> : null}
            {drifting.map(({ s, h: hh }) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-neutral-100">{s.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {d.teams.find((x) => x.id === s.team)?.name ?? 'No squad'} · {hh.filter(Boolean).length} of last {hh.length}
                  </div>
                </div>
                <div className="flex gap-[3px]">
                  {hh.map((v, i) => (
                    <span key={i} className="h-[12px] w-[7px] rounded-[2px]" style={{ background: v ? 'var(--color-accent-500)' : 'var(--color-neutral-800)' }} />
                  ))}
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="The plan" meta={yearLabel(p.settings.startYear, 0)} right={<Link href="/planner/roadmap" className="text-[12px] text-accent-300">Roadmap</Link>}>
            <div className="text-[12.5px] leading-[1.6] text-neutral-300">
              {y1.length} teaching series this year · {drafts} drafts across seven years
              {p.published ? ' · published ' + new Date(p.published.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ' · never published'}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
