'use client';
/* PLANNER · LITURGICAL — the church year laid over the ministry year:
   a wheel from August round to July, the days and seasons as a list, which
   ones this ministry keeps, and where a holy day lands on a gathering
   night. Dates are computed (Meeus for Easter); nothing is looked up. */
import Link from 'next/link';
import { useState } from 'react';
import { PageHead, Panel, Toggle, usePlanSave } from '@/components/planner/kit';
import { cx } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { addDays, churchYear, type HolyDay } from '@/lib/liturgical';
import { inBlackout, nightsOf, yearBounds, yearLabel, yearOf } from '@/lib/plan';
import { useApp } from '@/lib/store/provider';

/* Muted versions of the traditional colors, one lightness for all. */
const SEASON_COLOR: Record<string, string> = {
  advent: 'oklch(0.58 0.09 285)',
  christmastide: 'oklch(0.78 0.07 85)',
  lent: 'oklch(0.52 0.08 310)',
  holyweek: 'oklch(0.55 0.11 24)',
  eastertide: 'oklch(0.8 0.08 90)',
  ordinary: 'oklch(0.6 0.07 150)'
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** The church year's days and seasons that touch one ministry year, with
 *  seasons clipped to it. */
function yearDays(from: string, to: string): HolyDay[] {
  const y0 = Number(from.slice(0, 4));
  const all = [...churchYear(y0 - 1), ...churchYear(y0), ...churchYear(y0 + 1)];
  return all
    .filter((h) => (h.kind === 'day' ? h.date >= from && h.date <= to : (h.until ?? h.date) >= from && h.date <= to))
    .map((h) => (h.kind === 'season' ? { ...h, date: h.date < from ? from : h.date, until: (h.until ?? h.date) > to ? to : h.until } : h))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'season' ? -1 : 1));
}

export function Liturgical() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const today = isoDay(new Date());
  const [y, setY] = useState(() => Math.max(0, Math.min(6, yearOf(p, today))));
  const sy = p.settings.startYear;
  const { from, to } = yearBounds(p, y);
  const days = yearDays(from, to);
  const nights = new Set(nightsOf(p, y));
  const gather = WEEKDAYS[p.settings.gatherDay];
  const on = (id: string) => p.holyDays[id] !== false;

  /* A clash: the day itself is a gathering night, or a short season (Holy
     Week) contains one. Blacked-out dates are named as such. */
  const clashes = days.flatMap((h): { h: HolyDay; night: string | null; line: string }[] => {
    if (!on(h.id)) return [];
    if (h.kind === 'day') {
      if (nights.has(h.date)) return [{ h, night: h.date, line: h.name + ' falls on a ' + gather + ' gathering.' }];
      if (inBlackout(p, h.date) && new Date(h.date + 'T12:00:00').getDay() === p.settings.gatherDay) return [{ h, night: null, line: h.name + ' is a ' + gather + ', but it’s inside a blackout — no gathering.' }];
      return [];
    }
    if (h.id !== 'holyweek') return [];
    const n = [...nights].find((x) => x >= h.date && x <= (h.until ?? h.date));
    return n ? [{ h, night: n, line: 'Holy Week includes your ' + gather + ' night, ' + fmt(n) + '.' }] : [];
  });

  return (
    <>
      <PageHead
        kicker={p.settings.name}
        title="Liturgical year"
        sub={'The church year across ' + yearLabel(sy, y) + ', August round to July. Seasons start where the calendar puts them; your gathering night is ' + gather + '.'}
        right={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-neutral-400">
              <Toggle on={p.settings.liturgical} onChange={(v) => save((x) => void (x.settings.liturgical = v), v ? 'Turned on the church year' : 'Turned off the church year', { log: true })} label="Show the church year across the planner" />
              Show across the planner
            </label>
            <select className="input !min-h-9 !w-auto !py-0 text-[12.5px]" value={y} onChange={(e) => setY(Number(e.target.value))} aria-label="Ministry year">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <option key={i} value={i}>
                  {yearLabel(sy, i)}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,460px)_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title="The wheel" meta={fmt(from).replace(/^\w+, /, '') + ' → ' + fmt(to).replace(/^\w+, /, '')}>
            <Wheel from={from} to={to} days={days.filter((h) => on(h.id))} nights={[...nights]} today={today} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-400">
              {Object.entries({ advent: 'Advent', christmastide: 'Christmas', ordinary: 'Ordinary Time', lent: 'Lent', holyweek: 'Holy Week', eastertide: 'Easter' }).map(([k, label]) => (
                <span key={k} className="flex items-center gap-[6px]">
                  <span className="h-[9px] w-[9px] rounded-sm" style={{ background: SEASON_COLOR[k] }} />
                  {label}
                </span>
              ))}
              <span className="flex items-center gap-[6px]">
                <span className="h-[9px] w-[2px] bg-neutral-400" />
                {gather} nights
              </span>
            </div>
          </Panel>
          <Panel title="Where it meets your nights" meta={clashes.length ? clashes.length + '' : ''}>
            {!clashes.length ? <div className="text-[12.5px] text-neutral-500">No holy day you keep lands on a gathering night this year.</div> : null}
            {clashes.map((c, i) => (
              <div key={i} className="flex items-start gap-3 border-t border-divider pt-2 text-[12.5px] first:border-t-0 first:pt-0">
                <span className="mt-[6px] h-[7px] w-[7px] flex-none rotate-45 bg-accent-300" />
                <span className="flex-1 leading-[1.5] text-neutral-200">{c.line}</span>
                {c.night ? (
                  <Link href={'/planner/season?night=' + c.night} className="flex-none text-[12px] text-accent-300">
                    Plan the night
                  </Link>
                ) : null}
              </div>
            ))}
          </Panel>
        </div>
        <Panel title="Days and seasons" meta="Turn off what this ministry doesn’t keep">
          <div className="flex flex-col">
            {days.map((h) => {
              const clash = clashes.some((c) => c.h === h);
              const span = h.kind === 'season' && h.until ? Math.round((new Date(h.until + 'T12:00:00').getTime() - new Date(h.date + 'T12:00:00').getTime()) / 864e5) + 1 : 0;
              return (
                <div key={h.id + h.date} className={cx('flex items-center gap-3 border-t border-divider py-[9px] first:border-t-0', !on(h.id) && 'opacity-50')}>
                  <span className={cx('flex-none', h.kind === 'season' ? 'h-[10px] w-[10px] rounded-sm' : 'ml-[2px] h-[7px] w-[7px] rotate-45')} style={{ background: h.kind === 'season' ? SEASON_COLOR[h.id] ?? 'var(--color-neutral-600)' : 'var(--color-accent-300)' }} />
                  <div className="min-w-0 flex-1">
                    <div className={cx('text-[13px] text-neutral-100', h.kind === 'season' && 'font-medium')}>
                      {h.name}
                      {clash ? <span className="ml-2 rounded-full border border-accent-500 px-[6px] py-[1px] text-[10px] text-accent-200">your {gather} night</span> : null}
                    </div>
                    <div className="text-[11px] text-neutral-500">{h.kind === 'season' && h.until ? fmt(h.date) + ' – ' + fmt(h.until) + ' · ' + span + ' days' : fmt(h.date)}</div>
                  </div>
                  <Toggle on={on(h.id)} onChange={(v) => save((x) => void (x.holyDays = { ...x.holyDays, [h.id]: v }), (v ? 'Keep ' : 'Stop showing ') + h.name, { log: true })} label={'Keep ' + h.name} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* The ministry year as a circle, August at the top, clockwise. */
function Wheel({ from, to, days, nights, today }: { from: string; to: string; days: HolyDay[]; nights: string[]; today: string }) {
  const t0 = new Date(from + 'T12:00:00').getTime();
  const total = new Date(addDays(to, 1) + 'T12:00:00').getTime() - t0;
  const ang = (iso: string) => ((new Date(iso + 'T12:00:00').getTime() - t0) / total) * Math.PI * 2 - Math.PI / 2;
  const C = 160;
  const pt = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, r1);
    const [x1, y1] = pt(a1, r1);
    const [x2, y2] = pt(a1, r0);
    const [x3, y3] = pt(a0, r0);
    return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const y0 = Number(from.slice(0, 4));
  const firsts = months.map((m, i) => {
    const mm = ((i + 7) % 12) + 1;
    return { m, iso: (mm >= 8 ? y0 : y0 + 1) + '-' + String(mm).padStart(2, '0') + '-01' };
  });
  const seasons = days.filter((h) => h.kind === 'season');
  const inYear = today >= from && today <= to;
  return (
    <svg viewBox="0 0 320 320" className="mx-auto w-full max-w-[400px]" role="img" aria-label="The church year as a wheel">
      <circle cx={C} cy={C} r={128} fill="none" stroke={SEASON_COLOR.ordinary} strokeOpacity={0.35} strokeWidth={28} />
      {seasons
        .filter((s) => s.id !== 'ordinary')
        .map((s) => (
          <path key={s.id + s.date} d={arc(ang(s.date), ang(addDays(s.until ?? s.date, 1)), s.id === 'holyweek' ? 114 : 116, s.id === 'holyweek' ? 146 : 140)} fill={SEASON_COLOR[s.id] ?? 'var(--color-neutral-600)'} fillOpacity={s.id === 'holyweek' ? 0.95 : 0.8}>
            <title>{s.name}</title>
          </path>
        ))}
      {seasons
        .filter((s) => s.id === 'ordinary')
        .map((s) => (
          <path key={s.id + s.date} d={arc(ang(s.date), ang(addDays(s.until ?? s.date, 1)), 116, 140)} fill={SEASON_COLOR.ordinary} fillOpacity={0.55}>
            <title>Ordinary Time</title>
          </path>
        ))}
      {nights.map((n) => {
        const [x0, y0_] = pt(ang(n), 100);
        const [x1, y1] = pt(ang(n), 108);
        return <line key={n} x1={x0} y1={y0_} x2={x1} y2={y1} stroke="var(--color-neutral-400)" strokeWidth={1.2} />;
      })}
      {firsts.map(({ m, iso }) => {
        const a = ang(iso);
        const [x0, y0_] = pt(a, 88);
        const [x1, y1] = pt(a, 96);
        const [tx, ty] = pt(ang(addDays(iso, 14)), 80);
        return (
          <g key={m}>
            <line x1={x0} y1={y0_} x2={x1} y2={y1} stroke="var(--color-neutral-700)" />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fill="var(--color-neutral-500)">
              {m}
            </text>
          </g>
        );
      })}
      {days
        .filter((h) => h.kind === 'day')
        .map((h) => {
          const [x, y] = pt(ang(h.date), 152);
          return (
            <g key={h.id + h.date}>
              <rect x={x - 3} y={y - 3} width={6} height={6} transform={`rotate(45 ${x} ${y})`} fill="var(--color-accent-300)" />
              <title>{h.name + ' · ' + fmt(h.date)}</title>
            </g>
          );
        })}
      {inYear ? (
        (() => {
          const [x0, y0_] = pt(ang(today), 60);
          const [x1, y1] = pt(ang(today), 156);
          return <line x1={x0} y1={y0_} x2={x1} y2={y1} stroke="var(--color-accent-400)" strokeWidth={1.5} />;
        })()
      ) : null}
      <text x={C} y={C - 6} textAnchor="middle" fontSize={13} fill="var(--color-neutral-100)" fontWeight={500}>
        {from.slice(0, 4)}–{to.slice(2, 4)}
      </text>
      <text x={C} y={C + 12} textAnchor="middle" fontSize={9.5} fill="var(--color-neutral-500)">
        {inYear ? 'Today ' + fmt(today).replace(/^\w+, /, '') : 'Ministry year'}
      </text>
    </svg>
  );
}
