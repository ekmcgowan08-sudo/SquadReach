'use client';
/* PLANNER · MINISTRY YEAR — one year, August to July, by lane. Seasons and
   the church year run across the top; every gathering night is a tick, so
   blackouts and the teaching flow read at a glance. Drag an item to a month
   (or Alt+arrow) to set when it starts; "Anytime" means no month yet. */
import { useState } from 'react';
import { ItemPanel, KINDS } from '@/components/planner/item-panel';
import { PageHead, UndoButtons, usePlanSave } from '@/components/planner/kit';
import { Icon, cx } from '@/components/ui';
import { holyDaysBetween } from '@/lib/liturgical';
import { MONTHS_FROM_AUG, laneColor, monthIndex, nightsOf, seasonsOf, teachingByNight, yearBounds, yearLabel, yearOf, type PlanItem } from '@/lib/plan';
import { isoDay } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';

/** Where a date sits across the year, 0–1. */
const at = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const dim = new Date(y, m, 0).getDate();
  return (monthIndex(iso) + (Number(iso.slice(8, 10)) - 1) / dim) / 12;
};
const short = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
/* Labels share three rows; one that fits nowhere keeps its diamond and a
   tooltip. Widths are estimated against the board's minimum width. */
function labelRows<T extends { name: string; date: string }>(days: T[]) {
  const ends = [-1, -1, -1];
  return days.map((h) => {
    const w = (h.name.length * 5.3 + 10) / 1100;
    const start = at(h.date) - w / 2;
    const row = ends.findIndex((e) => e <= start);
    if (row >= 0) ends[row] = start + w;
    return { h, row: row >= 0 ? row : null };
  });
}
const BAND = ['oklch(0.63 0.085 292)', 'oklch(0.63 0.085 208)', 'oklch(0.63 0.085 168)', 'oklch(0.63 0.085 42)', 'oklch(0.63 0.085 18)', 'oklch(0.63 0.085 330)'];

export function YearBoard() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const today = isoDay(new Date());
  const [y, setY] = useState(() => Math.max(0, Math.min(6, yearOf(p, today))));
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const sy = p.settings.startYear;
  const lanes = p.lanes.filter((l) => l.on);
  const nights = nightsOf(p, y);
  const seasons = seasonsOf(p, y);
  const byNight = teachingByNight(p, y);
  const bounds = yearBounds(p, y);
  const holy = p.settings.liturgical ? holyDaysBetween(bounds.from, bounds.to).filter((h) => p.holyDays[h.id] !== false) : [];
  const nowAt = yearOf(p, today) === y ? at(today) : null;
  const seriesSpan = (s: PlanItem) => {
    const ns = Object.entries(byNight)
      .filter(([, v]) => v.series.id === s.id)
      .map(([n]) => n)
      .sort();
    return ns.length ? { from: ns[0], to: ns[ns.length - 1], n: ns.length } : null;
  };

  const move = (id: string, lane: string, month: number | undefined) => {
    const it = p.items.find((i) => i.id === id);
    if (!it || (it.lane === lane && it.month === month)) return;
    save((x) => void (x.items = x.items.map((i) => (i.id === id ? { ...i, lane, month } : i))), 'Move ' + it.title + ' to ' + (month === undefined ? 'anytime' : MONTHS_FROM_AUG[month]));
  };
  const add = (lane: string, month: number | undefined) => {
    const id = uid();
    save((x) => void x.items.push({ id, lane, year: y, month, title: 'New ' + (lane === 'teach' ? 'series' : 'item'), kind: lane === 'teach' ? 'series' : lane === 'goals' ? 'goal' : 'event', size: lane === 'teach' ? 4 : 1, status: 'draft', notes: '', tags: [] }), 'Add an item to ' + (month === undefined ? yearLabel(sy, y) : MONTHS_FROM_AUG[month]));
    setOpen(id);
  };
  const onKey = (e: React.KeyboardEvent, it: PlanItem) => {
    if (!e.altKey) return;
    const li = lanes.findIndex((l) => l.id === it.lane);
    const m = it.month;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = e.key === 'ArrowLeft' ? (m === undefined ? 11 : m === 0 ? undefined : m - 1) : m === undefined ? 0 : m === 11 ? undefined : m + 1;
      move(it.id, it.lane, next);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const lane = lanes[Math.max(0, Math.min(lanes.length - 1, li + (e.key === 'ArrowUp' ? -1 : 1)))];
      if (lane) move(it.id, lane.id, m);
    }
  };
  const dropProps = (cell: string, lane: string, month: number | undefined) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!drag) return;
      e.preventDefault();
      setOver(cell);
    },
    onDragLeave: () => setOver((o) => (o === cell ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (drag) move(drag, lane, month);
      setDrag(null);
      setOver(null);
    }
  });

  const cols = '170px repeat(12, minmax(88px, 1fr)) 120px';
  return (
    <>
      <PageHead
        kicker={p.settings.name}
        title={'Ministry year ' + yearLabel(sy, y)}
        sub={'Year ' + (y + 1) + ' of 7 · ' + nights.length + ' ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.settings.gatherDay] + ' nights · ' + Object.keys(byNight).length + ' taught · ' + p.items.filter((i) => i.year === y).length + ' items'}
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-neutral-800 p-1">
              <button aria-label="Previous year" disabled={y === 0} onClick={() => setY(y - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
                <Icon name="ph ph-caret-left" className="text-[13px]" />
              </button>
              <select className="bg-transparent px-1 text-[12.5px] text-neutral-100 outline-none" value={y} onChange={(e) => setY(Number(e.target.value))} aria-label="Ministry year">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <option key={i} value={i}>
                    {yearLabel(sy, i)}
                  </option>
                ))}
              </select>
              <button aria-label="Next year" disabled={y === 6} onClick={() => setY(y + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
                <Icon name="ph ph-caret-right" className="text-[13px]" />
              </button>
            </div>
            <UndoButtons />
          </div>
        }
      />
      <div className="mb-3 text-[11.5px] text-neutral-500">Drag an item to a month or lane, or focus it and press Alt + arrows. Teaching series run back to back from their month; the ticks show which night each one lands on.</div>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <div className="grid min-w-[1360px]" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-10 border-b border-neutral-800 bg-surface px-3 py-2 text-[11px] text-neutral-500">Month</div>
          {MONTHS_FROM_AUG.map((m, i) => (
            <div key={m} className="border-b border-l border-neutral-800 px-2 py-2">
              <div className="text-[12.5px] font-medium text-neutral-100">{m}</div>
              <div className="text-[10.5px] text-neutral-500">{nights.filter((n) => monthIndex(n) === i).length} nights</div>
            </div>
          ))}
          <div className="border-b border-l border-neutral-800 px-2 py-2 text-[12.5px] font-medium text-neutral-300">Anytime</div>

          {/* seasons, church year and nights share one proportional track */}
          <Track label="Seasons">
            {seasons.map((s, i) => (
              <div key={s.id} className="absolute inset-y-[6px] overflow-hidden rounded px-2 text-[10.5px] leading-[22px] text-neutral-100" title={s.name + ' · ' + short(s.from) + ' – ' + short(s.to) + ' · ' + s.nights.length + ' nights'} style={{ left: at(s.from) * 100 + '%', width: Math.max(0.6, (at(s.to) - at(s.from)) * 100 + 0.25) + '%', background: 'color-mix(in srgb, ' + BAND[i % BAND.length] + ' 30%, transparent)', borderLeft: '2px solid ' + BAND[i % BAND.length] }}>
                <span className="truncate">{s.name}</span>
              </div>
            ))}
          </Track>
          {p.settings.liturgical ? (
            <Track label="Church year" tall>
              {labelRows(holy.filter((h) => h.kind === 'day')).map(({ h, row }) => (
                <div key={h.id + h.date} className="absolute flex flex-col items-center" style={{ left: at(h.date) * 100 + '%', top: 5 }} title={h.name + ' · ' + short(h.date)}>
                  <span className="h-[6px] w-[6px] -translate-x-1/2 rotate-45 bg-accent-300" />
                  {row !== null ? (
                    <span className="absolute -translate-x-1/2 whitespace-nowrap text-[9.5px] leading-none text-neutral-400" style={{ top: 10 + row * 12 }}>
                      {h.name}
                    </span>
                  ) : null}
                </div>
              ))}
            </Track>
          ) : null}
          <Track label="Nights">
            {p.settings.blackouts
              .filter(([a, b]) => b >= bounds.from && a <= bounds.to)
              .map(([a, b]) => {
                const from = a < bounds.from ? bounds.from : a;
                const to = b > bounds.to ? bounds.to : b;
                return <div key={a} className="absolute inset-y-[6px] rounded bg-neutral-800/70" style={{ left: at(from) * 100 + '%', width: Math.max(0.3, (at(to) - at(from)) * 100) + '%' }} title={'No gathering · ' + short(from) + ' – ' + short(to)} />;
              })}
            {nights.map((n) => {
              const t = byNight[n];
              const lane = p.lanes.find((l) => l.id === 'teach');
              return <span key={n} className="absolute top-[8px] h-[18px] w-[4px] -translate-x-1/2 rounded-sm" style={{ left: at(n) * 100 + '%', background: t ? laneColor(lane?.hue ?? 292) : 'var(--color-neutral-700)', opacity: t ? 0.55 + (0.45 * t.week) / t.of : 1 }} title={short(n) + (t ? ' · ' + t.series.title + ', week ' + t.week + ' of ' + t.of : ' · not taught yet')} />;
            })}
            {nowAt !== null ? <span className="absolute inset-y-[2px] w-[2px] bg-accent-400" style={{ left: nowAt * 100 + '%' }} title="Today" /> : null}
          </Track>

          {lanes.map((l) => (
            <div key={l.id} className="contents">
              <div className="sticky left-0 z-10 flex items-start gap-2 border-b border-neutral-800 bg-surface px-3 py-2">
                <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: laneColor(l.hue) }} />
                <span className="text-[12px] leading-[1.3] text-neutral-300">{l.name}</span>
              </div>
              {[...MONTHS_FROM_AUG.map((_, i) => i as number | undefined), undefined].map((m) => {
                const cell = l.id + '|' + (m ?? 'any');
                const items = p.items.filter((i) => i.year === y && i.lane === l.id && i.month === m);
                return (
                  <div key={cell} {...dropProps(cell, l.id, m)} className={cx('group flex min-h-[54px] flex-col gap-1 border-b border-l border-neutral-800 p-[5px]', drag && 'outline outline-1 -outline-offset-2 outline-neutral-800', over === cell && 'bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-accent-500')}>
                    {items.map((it) => {
                      const span = it.kind === 'series' && it.lane === 'teach' ? seriesSpan(it) : null;
                      return (
                        <button
                          key={it.id}
                          draggable
                          onDragStart={(e) => {
                            setDrag(it.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', it.id);
                          }}
                          onDragEnd={() => {
                            setDrag(null);
                            setOver(null);
                          }}
                          onClick={() => setOpen(it.id)}
                          onKeyDown={(e) => onKey(e, it)}
                          className={cx('flex flex-col rounded-md px-[6px] py-1 text-left text-[11px] leading-[1.25]', it.status === 'draft' && 'italic')}
                          style={{ background: it.status === 'confirmed' ? 'color-mix(in srgb, ' + laneColor(l.hue) + ' 22%, var(--color-neutral-900))' : 'transparent', border: '1px ' + (it.status === 'draft' ? 'dashed' : 'solid') + ' ' + laneColor(l.hue), color: 'var(--color-neutral-100)', opacity: drag === it.id ? 0.4 : 1 }}
                          title={KINDS[it.kind].label}
                        >
                          <span>{it.title}</span>
                          {span ? (
                            <span className="text-[10px] not-italic text-neutral-400">
                              {short(span.from)} – {short(span.to)}
                              {span.n < it.size ? ' · ' + (it.size - span.n) + ' weeks don’t fit' : ''}
                            </span>
                          ) : it.kind === 'series' ? (
                            <span className="text-[10px] not-italic text-neutral-400">{it.size} weeks</span>
                          ) : it.size > 1 && it.kind !== 'goal' && it.kind !== 'milestone' ? (
                            <span className="text-[10px] not-italic text-neutral-400">
                              {it.size} {KINDS[it.kind].size.toLowerCase()}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    <button onClick={() => add(l.id, m)} aria-label={'Add to ' + l.short + (m === undefined ? ', anytime' : ' in ' + MONTHS_FROM_AUG[m])} className="mt-auto self-start rounded px-1 text-[10.5px] text-neutral-600 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {open ? <ItemPanel id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Track({ label, tall, children }: { label: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-neutral-800 bg-surface px-3 py-2 text-[11.5px] text-neutral-500">{label}</div>
      <div className="relative border-b border-l border-neutral-800" style={{ gridColumn: '2 / span 12', height: tall ? 54 : 34 }}>
        {MONTHS_FROM_AUG.slice(1).map((m, i) => (
          <span key={m} className="absolute inset-y-0 w-px bg-neutral-800/60" style={{ left: ((i + 1) / 12) * 100 + '%' }} />
        ))}
        {children}
      </div>
      <div className="border-b border-l border-neutral-800" />
    </>
  );
}
