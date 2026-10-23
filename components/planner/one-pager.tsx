'use client';
/* PLANNER · ONE-PAGER — the seven years on one landscape sheet. Two
   audiences: parents & students see the student-facing lanes; elders &
   staff see every lane and the teaching weeks per year. It reads the live
   plan, so it's never out of date; paper and ground are remembered on this
   device. Prints alone — the planner around it is hidden on paper. */
import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Btn, Icon } from '@/components/ui';
import { MONTHS_FROM_AUG, nightsOf, yearLabel } from '@/lib/plan';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { useApp } from '@/lib/store/provider';

const PUBLIC = ['teach', 'events', 'groups', 'lead', 'outreach', 'trips', 'parents'];
const PAPER = { letter: { w: '11in', h: '8.5in', page: 'letter landscape' }, a4: { w: '297mm', h: '210mm', page: 'A4 landscape' } } as const;
const THEMES = {
  light: { bg: 'oklch(0.985 0.004 270)', ink: 'oklch(0.24 0.02 270)', mute: 'oklch(0.44 0.015 270)', rule: 'oklch(0.88 0.006 270)', strong: 'oklch(0.24 0.02 270)', kicker: 'oklch(0.46 0.1 285)', yr0: 'oklch(0.955 0.012 285)', cell0: 'oklch(0.97 0.008 285)', draft: 'oklch(0.46 0.015 270)', lane: (h: number) => 'oklch(0.58 0.1 ' + h + ')' },
  dark: { bg: 'var(--color-bg)', ink: 'var(--color-text)', mute: 'var(--color-neutral-400)', rule: 'var(--color-neutral-800)', strong: 'var(--color-neutral-300)', kicker: 'var(--color-accent-300)', yr0: 'var(--color-accent-900)', cell0: 'color-mix(in oklch, var(--color-accent-900) 45%, transparent)', draft: 'var(--color-neutral-400)', lane: (h: number) => 'oklch(0.72 0.1 ' + h + ')' }
};
type Audience = 'family' | 'elders';

export function OnePager() {
  const p = useApp((s) => s.data.plan);
  const prefs = usePrefs().onePager;
  const params = useSearchParams();
  const [aud, setAud] = useState<Audience>(params.get('for') === 'elders' ? 'elders' : 'family');
  const [drafts, setDrafts] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const t = THEMES[prefs.ground];
  const paper = PAPER[prefs.paper];
  const elders = aud === 'elders';
  const sy = p.settings.startYear;
  const keep = (s: 'confirmed' | 'draft') => drafts || s === 'confirmed';
  const items = p.items.filter((i) => keep(i.status));
  const lanes = p.lanes.filter((l) => l.on && (elders || PUBLIC.includes(l.id)) && items.some((i) => i.lane === l.id));
  const years = [0, 1, 2, 3, 4, 5, 6];

  /* Shrink the grid until it fits the sheet; measured, never guessed. */
  useLayoutEffect(() => {
    const b = box.current;
    const g = grid.current;
    if (!b || !g) return;
    const fit = () => {
      const room = b.getBoundingClientRect().height;
      if (!room) return;
      const fits = (z: number) => {
        g.style.zoom = String(z);
        return g.getBoundingClientRect().height <= room + 0.5;
      };
      if (fits(1)) return;
      let lo = 0.4;
      let hi = 1;
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        if (fits(m)) lo = m;
        else hi = m;
      }
      g.style.zoom = String(Math.floor(lo * 1000) / 1000);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    return () => ro.disconnect();
  });

  useEffect(() => {
    if (params.get('print') !== '1') return;
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, [params]);

  const opt = 'min-h-9 rounded-full px-3 text-[12px] font-medium';
  const on = (x: boolean) => ({ background: x ? 'var(--color-neutral-800)' : 'transparent', color: x ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' });
  return (
    <>
      <style>{`@page { size: ${paper.page}; margin: 0 } @media print { body * { visibility: hidden !important } .sr-onepager, .sr-onepager * { visibility: visible !important } .sr-onepager { position: absolute !important; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; border: 0 !important } }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Btn variant="ghost" className="px-3 text-[12px]" href="/planner/roadmap">
          <Icon name="ph ph-arrow-left" className="mr-[6px] text-[13px]" />
          Roadmap
        </Btn>
        <div className="min-w-[200px] flex-1 text-[12px] text-neutral-500">Reads the live plan. Later years are a direction, not a commitment.</div>
        <div role="group" aria-label="Audience" className="flex gap-1 rounded-full border border-neutral-800 p-1">
          {(
            [
              ['family', 'Parents & students'],
              ['elders', 'Elders & staff']
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setAud(id)} aria-pressed={aud === id} className={opt} style={on(aud === id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Paper" className="flex gap-1 rounded-full border border-neutral-800 p-1">
          {(
            [
              ['letter', 'Letter'],
              ['a4', 'A4']
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setPrefs((x) => ({ onePager: { ...x.onePager, paper: id } }))} aria-pressed={prefs.paper === id} className={opt} style={on(prefs.paper === id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Ground" className="flex gap-1 rounded-full border border-neutral-800 p-1">
          {(
            [
              ['light', 'Light paper'],
              ['dark', 'Dark']
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setPrefs((x) => ({ onePager: { ...x.onePager, ground: id } }))} aria-pressed={prefs.ground === id} className={opt} style={on(prefs.ground === id)}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setDrafts(!drafts)} aria-pressed={drafts} className="min-h-9 rounded-full border border-neutral-800 px-3 text-[12px] text-neutral-300">
          {drafts ? 'Showing planned items' : 'Confirmed only'}
        </button>
        <Btn className="px-4 text-[12px]" onClick={() => window.print()}>
          <Icon name="ph ph-printer" className="mr-[6px] text-[14px]" />
          Print or save PDF
        </Btn>
      </div>
      <div className="overflow-x-auto pb-4">
        <section
          className="sr-onepager mx-auto flex flex-col gap-[14px] overflow-hidden rounded-sm border border-neutral-800 shadow-lg"
          style={{ width: paper.w, height: paper.h, background: t.bg, color: t.ink, padding: '0.42in 0.5in 0.36in', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          aria-label="One-pager"
        >
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="mb-2 text-[10.5px] font-medium uppercase leading-none tracking-[.12em]" style={{ color: t.kicker }}>
                Seven-year plan · for {elders ? 'elders & staff' : 'parents & students'}
              </div>
              <div className="text-[26px] font-medium leading-[1.1] tracking-[-.01em]">{p.settings.name}</div>
            </div>
            <div className="max-w-[380px] text-[12px] leading-[1.45] text-pretty" style={{ color: t.mute }}>
              This is the plan our student ministry team is working from. Later years are a direction, not a commitment; details are confirmed closer to each year.
            </div>
          </div>
          <div ref={box} className="min-h-0 flex-1 overflow-hidden">
            {!lanes.length ? (
              <div className="grid h-full place-items-center text-center text-[14px]" style={{ color: t.mute }}>
                Nothing to show yet. Add items on the roadmap{drafts ? '' : ', or show planned items'}.
              </div>
            ) : (
              <div ref={grid} className="grid content-start" style={{ gridTemplateColumns: '150px repeat(7, minmax(0, 1fr))', borderTop: '1.5px solid ' + t.strong }}>
                <div />
                {years.map((y) => {
                  const wk = items.filter((i) => i.year === y && i.kind === 'series' && i.lane === 'teach').reduce((n, i) => n + i.size, 0);
                  return (
                    <div key={y} className="px-2 py-[7px]" style={{ borderLeft: '1px solid ' + t.rule, background: y === 0 ? t.yr0 : 'transparent' }}>
                      <div className="text-[12px] font-medium leading-[1.2]">Year {y + 1}</div>
                      <div className="mt-[2px] text-[10px] leading-[1.3] tabular-nums" style={{ color: t.mute }}>
                        {yearLabel(sy, y)}
                        {elders ? ' · ' + wk + ' of ' + nightsOf(p, y).length + ' wks' : ''}
                      </div>
                    </div>
                  );
                })}
                {lanes.map((l) => (
                  <div key={l.id} className="contents">
                    <div className="flex items-start gap-[6px] py-[6px] pr-2" style={{ borderTop: '1px solid ' + t.rule }}>
                      <div className="min-h-3 w-[3px] self-stretch rounded-sm" style={{ background: t.lane(l.hue) }} />
                      <div className="text-[11px] font-medium leading-[1.25] text-pretty">{l.name}</div>
                    </div>
                    {years.map((y) => (
                      <div key={y} className="flex flex-col gap-[3px] px-2 py-[6px]" style={{ borderTop: '1px solid ' + t.rule, borderLeft: '1px solid ' + t.rule, background: y === 0 ? t.cell0 : 'transparent' }}>
                        {items
                          .filter((i) => i.lane === l.id && i.year === y)
                          .sort((a, b) => (a.month ?? 99) - (b.month ?? 99))
                          .map((i) => (
                            <div key={i.id} className="text-[10.5px] leading-[1.3] text-pretty" style={{ fontStyle: i.status === 'draft' ? 'italic' : undefined, color: i.status === 'draft' ? t.draft : t.ink }}>
                              {i.title}
                              {i.kind === 'series' ? ' (' + i.size + ' wks)' : i.month !== undefined ? ' · ' + MONTHS_FROM_AUG[i.month] : ''}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between gap-6 pt-2 text-[10px] leading-[1.4]" style={{ color: t.mute, borderTop: '1px solid ' + t.rule }}>
            <div>
              {drafts ? 'Items in italics are still being planned.' : 'Only confirmed items are shown.'}
              {elders ? ' Teaching weeks are counted against gathering nights per year.' : ''}
            </div>
            <div>Questions? Talk with any of our student ministry staff.</div>
          </div>
        </section>
      </div>
    </>
  );
}
