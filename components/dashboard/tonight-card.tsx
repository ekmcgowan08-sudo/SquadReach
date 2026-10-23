'use client';
/* HOME · TONIGHT — leaders only. The run of the night, the ready check, the
   posts with nobody on them and what is waiting on you, in one card. It is
   built from the SAME run sheet the 6:15 huddle reads and the console edits,
   so there is one plan for the night, not two to keep in step. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui';
import { availableBench, uncoveredPosts } from '@/lib/feeds';
import { leaderNeeds, myCycleNeeds, nightPhase } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';

const SEG = { pre: 'oklch(0.63 0.085 168)', main: 'oklch(0.63 0.085 292)', post: 'oklch(0.63 0.085 42)' };

export function TonightCard() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const h = d.huddle;
  const phase = useMemo(() => nightPhase(h.runSheet, h.runIdx, now), [h.runSheet, h.runIdx, now]);
  const m = useApp((s) => s.membership);
  const needs = useMemo(() => [...leaderNeeds(d), ...myCycleNeeds(d, m, now.getTime())].filter((n) => !h.dismissed[n.id]), [d, m, now, h.dismissed]);
  const posts = useMemo(() => uncoveredPosts(h), [h]);
  const bench = useMemo(() => availableBench(h), [h]);
  if (!phase) return null;
  const doneN = h.ready.filter((c) => c.done).length;
  const shownNeeds = open ? needs : needs.slice(0, 2);
  const segOf = (i: number) => (i === 0 ? SEG.pre : h.runSheet[i]?.debrief ? SEG.post : SEG.main);
  const debriefIdx = h.runSheet.findIndex((x) => x.debrief);
  const doors = h.runSheet.find((x) => x.label.toLowerCase().startsWith('doors'));

  const save = (recipe: (x: typeof h) => void) => {
    api().mutate((dd) => recipe(dd.huddle));
    api().emit({ kind: 'huddle', huddle: api().data.huddle });
  };

  return (
    <div data-screen-label="Home · Tonight" className="sr-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-col gap-[6px] px-[15px] pb-3 pt-[15px] text-left hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]">
        <div className="flex w-full items-center gap-2">
          <span className="text-[10px] font-semibold uppercase leading-none tracking-[.13em] text-accent-300">Tonight</span>
          <span className="h-[6px] w-[6px] rounded-full animate-sr-flash" style={{ background: phase.dot }} />
          <span className="min-w-0 flex-1 truncate text-[11px] leading-[1.2] text-neutral-400">{phase.line}</span>
          <Icon name="ph ph-caret-down" className="text-[13px] text-neutral-500" style={{ transform: 'rotate(' + (open ? 180 : 0) + 'deg)', transition: 'transform .2s' }} />
        </div>
        <div className="text-[17px] font-medium leading-[1.25] text-neutral-100">
          Week {d.config.weekNumber} of {d.config.seasonWeeks} · {d.config.gameName || 'Game night'}
        </div>
        <div className="relative mt-[6px] w-full">
          <div className="flex h-[10px] gap-[2px]">
            {phase.blocks.map((b, i) => {
              const c = segOf(i);
              return (
                <div
                  key={i}
                  className="rounded-[3px]"
                  style={{
                    flex: b.mins + ' 1 0',
                    background: b.cur
                      ? 'color-mix(in oklch, ' + c + ' 42%, var(--color-neutral-900))'
                      : b.past
                        ? 'color-mix(in oklch, ' + c + ' 10%, var(--color-neutral-900))'
                        : 'color-mix(in oklch, ' + c + ' 22%, var(--color-neutral-900))',
                    border: '1px solid ' + (b.cur ? c : 'transparent'),
                    transition: 'background .6s'
                  }}
                />
              );
            })}
          </div>
          {phase.during ? (
            <div className="absolute -bottom-1 -top-1 w-[2px] -ml-px rounded-sm bg-accent-200" style={{ left: phase.pct + '%', boxShadow: '0 0 8px var(--color-accent)', transition: 'left 1s linear' }} />
          ) : null}
        </div>
        <div className="tabular mt-[2px] flex w-full justify-between text-[10.5px] leading-none text-neutral-500">
          <span>{phase.blocks[0]?.at}</span>
          <span>{doors ? 'Doors ' + doors.time.replace('pm', ' pm').replace('am', ' am') : ''}</span>
          <span>{phase.blocks.length ? phase.blocks[phase.blocks.length - 1].at : ''}</span>
        </div>
      </button>

      {open ? (
        <>
          <div className="border-t border-divider px-[15px] pb-1 pt-3 animate-sr-rise">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Run of the night</div>
              <div className="text-[10.5px] leading-none text-neutral-500">{h.runSheet.length} blocks</div>
            </div>
            {phase.blocks.map((b, i) => (
              <div key={i} className="flex min-h-[34px] items-center gap-[10px] border-b border-divider">
                <span className="my-[7px] w-[3px] self-stretch rounded-sm" style={{ background: segOf(i) }} />
                <span className="tabular w-[50px] flex-none text-[11px] leading-none text-neutral-500">{b.at.replace(' pm', 'p').replace(' am', 'a')}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.2]" style={{ fontWeight: b.cur ? 600 : 400, color: b.cur ? 'var(--color-accent-100)' : b.past ? 'var(--color-neutral-500)' : 'var(--color-neutral-100)' }}>
                  {b.label}
                </span>
                <span className="whitespace-nowrap text-[11px] leading-none text-neutral-500">{b.who}</span>
              </div>
            ))}
          </div>
          <div className="px-[15px] pb-[6px] pt-3">
            <div className="mb-[6px] flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Ready check</div>
              <div className="tabular text-[10.5px] leading-none text-neutral-400">
                {doneN} of {h.ready.length}
              </div>
            </div>
            <div className="mb-[2px] h-[3px] overflow-hidden rounded-sm bg-neutral-800">
              <div className="h-full bg-accent-500" style={{ width: (doneN / Math.max(1, h.ready.length)) * 100 + '%', transition: 'width .4s ease' }} />
            </div>
            {h.ready.map((c) => (
              <button
                key={c.id}
                aria-pressed={c.done}
                onClick={() => save((x) => {
                  const it = x.ready.find((r) => r.id === c.id);
                  if (it) it.done = !it.done;
                })}
                className="flex min-h-11 w-full items-center gap-[11px] border-b border-divider text-left"
              >
                <span
                  className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px]"
                  style={{ border: '1.5px solid ' + (c.done ? 'var(--color-accent-500)' : 'var(--color-neutral-600)'), background: c.done ? 'var(--color-accent-500)' : 'transparent', transition: 'all .2s' }}
                >
                  <Icon name="ph ph-check" className="text-[11px] text-bg" style={{ opacity: c.done ? 1 : 0 }} />
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] leading-[1.25]" style={{ color: c.done ? 'var(--color-neutral-500)' : 'var(--color-neutral-100)', textDecoration: c.done ? 'line-through' : 'none' }}>
                  {c.label}
                </span>
                <span className="text-[10.5px] leading-none text-neutral-500">{c.who}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {posts.length ? (
        <div className="border-t border-divider">
          {posts.map((u) => (
            <div key={u.id} className="border-b border-divider px-[15px]">
              <div className="flex min-h-11 items-center gap-[10px]">
                <Icon name="ph ph-user-plus" className="text-[15px] text-accent-300" />
                <span className="min-w-0 flex-1 text-[12px] leading-[1.3] text-neutral-200">{u.post} is open</span>
                <button
                  onClick={() => setPicking(picking === u.id ? null : u.id)}
                  aria-expanded={picking === u.id}
                  className="min-h-11 min-w-14 rounded-sm border border-accent px-[10px] text-[11.5px] font-medium leading-none text-accent-200"
                >
                  {picking === u.id ? 'Cancel' : 'Fill'}
                </button>
              </div>
              {picking === u.id ? (
                <div className="flex flex-wrap gap-[6px] pb-3 pl-[25px] animate-sr-rise">
                  {bench.length ? (
                    bench.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          save((x) => {
                            if (Object.values(x.covered).includes(b.id)) return;
                            x.covered[u.id] = b.id;
                            x.crewState['sub_' + b.id] = 'here';
                          });
                          api().logActivity(b.name + ' is covering ' + u.post);
                          api().say(b.name + ' is on ' + u.post + '.');
                          setPicking(null);
                        }}
                        className="min-h-11 rounded-full border border-neutral-700 px-3 text-[12px] leading-none text-neutral-200"
                      >
                        {b.name}
                      </button>
                    ))
                  ) : (
                    <div className="text-[11.5px] text-neutral-500">The bench is empty — everyone not serving tonight has been asked.</div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="border-t border-divider px-[15px] pb-1 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Needs you</div>
          <div className="text-[10.5px] leading-none text-neutral-400">{needs.length ? needs.length + ' open' : ''}</div>
        </div>
        {shownNeeds.map((n) => (
          <div key={n.id} className="flex items-start gap-[11px] border-b border-divider py-[10px] animate-sr-rise">
            <Icon name={'ph ' + n.icon} className="mt-[1px] flex-none text-[16px] text-accent-300" />
            <Link href={n.href} className="min-w-0 flex-1" style={{ color: 'inherit' }}>
              <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-100">{n.title}</div>
              <div className="mt-[2px] text-[11px] leading-[1.45] text-neutral-500 text-pretty">{n.meta}</div>
            </Link>
            <button
              aria-label="Mark done"
              title="Mark done"
              onClick={() => save((x) => {
                x.dismissed[n.id] = true;
              })}
              className="-my-[10px] -mr-3 flex h-11 w-11 flex-none items-center justify-center text-neutral-500 hover:text-accent-200"
            >
              <Icon name="ph ph-check-circle" className="text-[18px]" />
            </button>
          </div>
        ))}
        {!needs.length ? (
          <div className="flex min-h-10 items-center gap-[9px] text-[12px] leading-[1.3] text-neutral-400">
            <Icon name="ph ph-check-circle" className="text-[16px] text-accent-300" />
            Nothing waiting on you.
          </div>
        ) : null}
        {!open && needs.length > 2 ? (
          <button onClick={() => setOpen(true)} className="min-h-10 w-full text-left text-[11.5px] font-medium leading-none text-accent-200">
            Show {needs.length - 2} more and the ready check
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 border-t border-divider">
        <Link href="/dashboard/huddle" className="flex min-h-[52px] flex-col items-start justify-center gap-1 px-[15px] sr-hover" style={{ color: 'inherit' }}>
          <span className="text-[11.5px] font-medium leading-none text-neutral-100">Huddle</span>
          <span className="text-[10.5px] leading-[1.2] text-neutral-500">{h.runSheet[0] ? h.runSheet[0].time + ' · ' + h.runSheet[0].where : 'no run sheet'}</span>
        </Link>
        <Link href="/dashboard/recap" className="flex min-h-[52px] flex-col items-start justify-center gap-1 border-l border-divider px-[15px] sr-hover" style={{ color: 'inherit' }}>
          <span className="text-[11.5px] font-medium leading-none text-neutral-100">Recap</span>
          <span className="text-[10.5px] leading-[1.2]" style={{ color: phase.after ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
            {phase.after ? 'ready to share' : debriefIdx >= 0 ? 'opens at ' + h.runSheet[debriefIdx].time : 'after the night'}
          </span>
        </Link>
      </div>
      <div className="grid grid-cols-3 border-t border-divider">
        <Link href="/dashboard/huddle" className="flex min-h-[46px] items-center justify-center gap-[6px] text-[11.5px] font-medium leading-none text-neutral-200 sr-hover">
          <Icon name="ph ph-list-checks" className="text-[14px]" />
          Night plan
        </Link>
        <Link href="/projector" className="flex min-h-[46px] items-center justify-center gap-[6px] border-x border-divider text-[11.5px] font-medium leading-none text-accent-200 sr-hover">
          <Icon name="ph ph-broadcast" className="text-[14px]" />
          Projector
        </Link>
        <Link href="/console" className="flex min-h-[46px] items-center justify-center gap-[6px] text-[11.5px] font-medium leading-none text-neutral-200 sr-hover">
          <Icon name="ph ph-desktop" className="text-[14px]" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
