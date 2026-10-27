'use client';
/* PLANNER · HOME — tonight at a glance from a desk: what is being taught,
   the plan of the night with who leads each block, who is serving, the
   ready check, what is waiting on you, the students drifting away, and a
   tile each for the year, the roadmap, ministry time and the church year. */
import Link from 'next/link';
import { useMemo } from 'react';
import { useCycle } from '@/components/cycle/use-cycle';
import { problem } from '@/components/live/setup';
import { Panel } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { clock, countdown, history, whoServes } from '@/lib/cycle';
import { isoDay } from '@/lib/dates';
import { churchSeasonOn } from '@/lib/liturgical';
import { clockOf, orderOf, orderTimes, seasonOfNight, seasonsOf, teachingByNight, teachingOf, yearOf, yearLabel, type OrderBlock } from '@/lib/plan';
import { publishDiff } from '@/lib/plan-insights';
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
  const drafts = p.items.filter((x) => x.status === 'draft').length;
  const diff = publishDiff(p);
  const unpublished = diff.added.length + diff.changed.length + diff.removed.length;
  const today = isoDay(date);
  const nowMin = iso === today ? date.getHours() * 60 + date.getMinutes() : null;

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
            <NightStrip order={order} nowMin={nowMin} me={m.displayName} />
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
              <Btn variant="ghost" className="px-4" href={'/planner/live?night=' + iso}>
                <Icon name="ph ph-broadcast" className="mr-[6px] text-[14px]" />
                Ministry time
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
        </div>
      </div>

      <Glance iso={iso} today={today} unpublished={unpublished} drafts={drafts} />
    </div>
  );
}

const SEG_COLOR = { pre: 'oklch(0.66 0.08 165)', main: 'var(--color-accent-400)', post: 'oklch(0.7 0.09 55)' } as const;
const SEG_LABEL = { pre: 'Before the doors open', main: 'During the gathering', post: 'After' } as const;
const shortName = (n: string) => {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : n;
};

/** The night as one strip: each block as wide as it runs, grouped under
 *  before / during / after, with a line where the night is right now. */
function NightStrip({ order, nowMin, me }: { order: (OrderBlock & { start: number })[]; nowMin: number | null; me: string }) {
  const total = order.reduce((n, b) => n + b.mins, 0);
  if (!total) return null;
  const t0 = order[0].start;
  const doors = order.find((b) => b.seg === 'main');
  const groups: { seg: OrderBlock['seg']; blocks: typeof order; mins: number }[] = [];
  for (const b of order) {
    const g = groups[groups.length - 1];
    if (g && g.seg === b.seg) {
      g.blocks.push(b);
      g.mins += b.mins;
    } else groups.push({ seg: b.seg, blocks: [b], mins: b.mins });
  }
  const at = nowMin != null && nowMin >= t0 && nowMin < t0 + total ? (nowMin - t0) / total : null;
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="tabular relative h-[13px] text-[11.5px] leading-none text-neutral-400">
        <span className="absolute left-0">{clockOf(t0)}</span>
        {doors && doors.start > t0 ? (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: ((doors.start - t0) / total) * 100 + '%' }}>
            Doors {clockOf(doors.start)}
          </span>
        ) : null}
        <span className="absolute right-0">{clockOf(t0 + total)}</span>
      </div>
      <div className="relative flex gap-[3px]">
        {groups.map((g, gi) => (
          <div key={gi} className="flex min-w-0 flex-col gap-[6px]" style={{ flex: g.mins + ' 1 0' }}>
            <div className="flex gap-[3px]">
              {g.blocks.map((b) => (
                <div
                  key={b.id}
                  title={b.kind + ' · ' + clockOf(b.start) + ' · ' + b.mins + ' min' + (b.title ? ' · ' + b.title : '') + (b.lead ? ' · ' + b.lead : '')}
                  className="min-w-0 rounded-[4px] px-[7px] py-[6px]"
                  style={{ flex: b.mins + ' 1 0', background: 'color-mix(in srgb, ' + SEG_COLOR[b.seg] + ' 24%, var(--color-neutral-900))' }}
                >
                  <div className="truncate text-[11.5px] font-medium leading-[1.25] text-neutral-100">{b.kind}</div>
                  <div className="truncate text-[10.5px] leading-[1.25] text-neutral-300">{!b.lead ? 'Everyone' : b.lead === me ? 'You' : shortName(b.lead)}</div>
                </div>
              ))}
            </div>
            <div className="h-[2px] rounded-full" style={{ background: SEG_COLOR[g.seg] }} />
            <div className="truncate text-[10.5px] leading-none text-neutral-400">{SEG_LABEL[g.seg]}</div>
          </div>
        ))}
        {at != null ? <span aria-hidden className="pointer-events-none absolute -top-1 h-[46px] w-[2px] rounded-full bg-neutral-100" style={{ left: at * 100 + '%' }} /> : null}
      </div>
    </div>
  );
}

const longDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86_400_000);
const share = (from: string, to: string, at: string) => Math.max(0, Math.min(1, (daysBetween(from, at) + 1) / (daysBetween(from, to) + 1)));

/** Four ways out of Home: where the year, the roadmap, tonight's ministry
 *  time and the church year stand, each with a bar for how far along. */
function Glance({ iso, today, unpublished, drafts }: { iso: string; today: string; unpublished: number; drafts: number }) {
  const { d } = useCycle();
  const p = d.plan;
  const y = yearOf(p, today);
  const inPlan = y >= 0 && y < 7;
  const seasons = inPlan ? seasonsOf(p, y) : [];
  const cur = seasons.find((x) => today >= x.from && today <= x.to);
  const after = seasons.find((x) => x.from > today);
  const night = cur ? cur.nights.filter((n) => n <= iso).length : 0;
  const series = inPlan ? teachingOf(p, y).length : 0;
  const yearShare = inPlan ? share(seasons[0]?.from ?? today, seasons[seasons.length - 1]?.to ?? today, today) : 0;
  const acts = p.gatherings[iso]?.live?.acts ?? [];
  const ran = p.gatherings[iso]?.live?.results;
  const ready = acts.filter((a) => !problem(a)).length;
  const when = iso === today ? 'tonight' : new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const church = churchSeasonOn(today);
  const out = daysBetween(today, church.next.from);
  const tiles = [
    {
      icon: 'ph-calendar-blank',
      kicker: 'Ministry year',
      title: cur ? cur.name + (cur.nights.length ? ' · week ' + Math.max(1, night) + ' of ' + cur.nights.length : '') : inPlan ? 'Between seasons' : 'Outside the plan’s years',
      meta: after ? after.name + ' starts ' + longDay(after.from) + '.' : inPlan ? 'The last season of ' + yearLabel(p.settings.startYear, y) + '.' : 'Set the years on the roadmap.',
      href: '/planner/year',
      bars: seasons.length ? seasons.map((x) => ({ w: daysBetween(x.from, x.to) + 1, fill: share(x.from, x.to, today) * (today >= x.from ? 1 : 0) })) : [{ w: 1, fill: 0 }]
    },
    {
      icon: 'ph-rows',
      kicker: 'Roadmap',
      title: inPlan ? 'Year ' + (y + 1) + ' of 7 · ' + series + ' teaching series' : 'Seven years from ' + yearLabel(p.settings.startYear, 0),
      meta: (drafts ? drafts + (drafts === 1 ? ' draft' : ' drafts') + ' across the plan' : 'Everything confirmed') + (unpublished ? '. ' + unpublished + (unpublished === 1 ? ' change' : ' changes') + ' in year one to publish.' : '.'),
      href: unpublished ? '/planner/roadmap?publish=1' : '/planner/roadmap',
      bars: Array.from({ length: 7 }, (_, i) => ({ w: 1, fill: !inPlan ? (y >= 7 ? 1 : 0) : i < y ? 1 : i === y ? yearShare : 0 }))
    },
    {
      icon: 'ph-broadcast',
      kicker: 'Ministry time',
      title: !acts.length ? 'Nothing set up for ' + when : ran ? acts.length + (acts.length === 1 ? ' activity' : ' activities') + ' ran' : ready === acts.length ? acts.length + (acts.length === 1 ? ' activity' : ' activities') + ' ready for ' + when : ready + ' of ' + acts.length + ' activities ready',
      meta: ran ? 'Attached to the debrief for ' + longDay(iso) + '.' : acts.length ? 'Students join from the app: More → Live.' : 'Trivia, this-or-that, word clouds and verse fill-ins, on phones.',
      href: '/planner/live?night=' + iso + (ran ? '&tab=results' : ''),
      bars: [{ w: 1, fill: ran ? 1 : acts.length ? ready / acts.length : 0 }]
    },
    {
      icon: 'ph-sun-horizon',
      kicker: 'Liturgical',
      title: church.next.name + ' begins ' + longDay(church.next.from),
      meta: (out === 1 ? 'Tomorrow. ' : out + ' days out. ') + church.now.name + ' until then.' + (p.settings.liturgical ? '' : ' Holy days are off on the roadmap.'),
      href: '/planner/liturgical',
      bars: [
        { w: daysBetween(church.now.from, church.now.to) + 1, fill: share(church.now.from, church.now.to, today) },
        { w: 28, fill: 0 }
      ]
    }
  ];
  return (
    <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.kicker}
          href={t.href}
          className="flex min-h-[150px] flex-col gap-3 rounded-lg border border-neutral-800 px-[22px] py-5 transition-[border-color,transform] duration-200 hover:-translate-y-[2px] hover:border-accent-700"
          style={{ background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)' }}
        >
          <div className="flex items-center gap-2">
            <Icon name={'ph ' + t.icon} className="text-[16px] text-accent-300" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium uppercase leading-none tracking-[.12em] text-neutral-500">{t.kicker}</span>
            <Icon name="ph ph-arrow-up-right" className="text-[14px] text-neutral-500" />
          </div>
          <div className="text-[18px] font-medium leading-[1.25] text-neutral-100 text-pretty">{t.title}</div>
          <div className="mt-auto flex h-[6px] gap-[3px]" aria-hidden>
            {t.bars.map((b, i) => (
              <div key={i} className="relative overflow-hidden rounded-[3px] bg-neutral-800" style={{ flex: b.w + ' 1 0' }}>
                <div className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: Math.round(b.fill * 100) + '%', background: 'var(--color-accent)' }} />
              </div>
            ))}
          </div>
          <div className="text-[13.5px] leading-[1.35] text-neutral-400 text-pretty">{t.meta}</div>
        </Link>
      ))}
    </div>
  );
}
