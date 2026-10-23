'use client';
/* PLANNER · LIVE MINISTRY TIME — set up a night's activities, run them with
   the room screen and a student's phone side by side, and attach what
   happened to the night's debrief. */
import { useRouter, useSearchParams } from 'next/navigation';
import { LiveConsole, LiveResultsList } from '@/components/live/console';
import { RoomScreen, Scaled } from '@/components/live/room-screen';
import { LiveSetup, problem } from '@/components/live/setup';
import { StudentLive } from '@/components/live/student';
import { useLiveConsole } from '@/components/live/use-live';
import { useCycle } from '@/components/cycle/use-cycle';
import { PageHead, Panel, UndoButtons } from '@/components/planner/kit';
import { joinUrl } from '@/components/screens/live';
import { Btn, Icon } from '@/components/ui';
import { longDate as dayLabel } from '@/lib/dates';
import { nightsOf, yearOf } from '@/lib/plan';

type Tab = 'setup' | 'run' | 'results';

export function PlannerLive() {
  const { d, iso: tonight, today } = useCycle();
  const p = d.plan;
  const params = useSearchParams();
  const router = useRouter();
  const night = params.get('night') ?? tonight;
  const tab = (params.get('tab') as Tab) || 'setup';
  const go = (t: Tab, n = night) => router.replace('/planner/live?night=' + n + (t === 'setup' ? '' : '&tab=' + t));
  const y = yearOf(p, night);
  const nights = [...new Set([...nightsOf(p, y), ...nightsOf(p, y + 1)])].filter((n) => n >= today || n === night).slice(0, 16);
  const acts = p.gatherings[night]?.live?.acts ?? [];
  const issues = acts.filter((a) => problem(a)).length;

  return (
    <>
      <PageHead
        kicker={dayLabel(night) + (night === tonight ? ' · tonight' : '')}
        title="Live ministry time"
        sub={acts.length ? acts.length + ' activities' + (issues ? ' · ' + issues + ' need a look' : '') + ' · app users only' : 'Short activities on phones during ministry time. App users only; the room screen follows the leader’s phone.'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !min-h-9 !w-auto !py-0 text-[12.5px]" value={night} onChange={(e) => go(tab, e.target.value)} aria-label="Night">
              {(nights.includes(night) ? nights : [night, ...nights]).map((n) => (
                <option key={n} value={n}>
                  {dayLabel(n)}
                  {n === tonight ? ' · tonight' : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-1 rounded-full border border-neutral-800 p-1" role="tablist">
              {(
                [
                  ['setup', 'Set up'],
                  ['run', 'Run live'],
                  ['results', 'Results']
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => go(id)} className="min-h-8 rounded-full px-3 text-[12px] font-medium" style={{ background: tab === id ? 'var(--color-neutral-800)' : 'transparent', color: tab === id ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'setup' ? <UndoButtons /> : null}
          </div>
        }
      />
      {tab === 'setup' ? <LiveSetup night={night} /> : tab === 'run' ? <Run night={night} /> : <Results night={night} />}
    </>
  );
}

function Run({ night }: { night: string }) {
  const c = useLiveConsole(night);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)_340px]">
      <Panel title="Your phone" meta="the console">
        <LiveConsole c={c} roomHref={'/live/room?night=' + night} />
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-[12px] text-neutral-500">
          <Icon name="ph ph-projector-screen" className="text-[14px]" />
          <span className="flex-1">Room screen · {c.settings.layout === 'rail' ? 'Rail' : 'Stage'} layout</span>
          <a href={'/live/room?night=' + night} target="_blank" rel="noreferrer" className="text-accent-300">
            Open full screen
          </a>
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-800 shadow-lg">
          <Scaled>
            <RoomScreen room={c.ready ? c.room : null} joinUrl={joinUrl()} ministry={c.d.config.ministryName} now={c.now} />
          </Scaled>
        </div>
        {c.m.mode === 'demo' ? <div className="text-[11.5px] leading-[1.5] text-neutral-500">Demo: a pretend room answers as each activity opens, so the numbers move. Open the room screen in another window and it follows along.</div> : null}
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] text-neutral-500">A student’s phone</div>
        <div className="mx-auto w-full max-w-[340px] rounded-[28px] border border-neutral-800 bg-bg p-4 shadow-lg" style={{ minHeight: 560 }}>
          <StudentLive night={night} preview />
        </div>
        {c.m.mode !== 'demo' ? <div className="text-[11.5px] text-neutral-500">Preview only — what you tap here isn’t counted.</div> : null}
      </div>
    </div>
  );
}

function Results({ night }: { night: string }) {
  const c = useLiveConsole(night);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="What happened" meta={c.lines.length ? c.lines.length + ' ran' : ''}>
        <LiveResultsList c={c} />
      </Panel>
      <Panel title="Tonight’s ranks" meta={c.settings.points === 'on' ? c.board.length + ' scored' : 'points off'}>
        {!c.board.length ? <div className="text-[12.5px] text-neutral-500">Nobody has scored yet.</div> : null}
        {c.board.slice(0, 20).map((b, i) => (
          <div key={i} className="flex items-baseline gap-3 text-[13px]">
            <span className="w-5 text-right tabular-nums text-neutral-500">{i + 1}</span>
            <span className="flex-1 text-neutral-100">{b.name}</span>
            <span className="tabular-nums text-neutral-400">{b.pts.toLocaleString('en-US')}</span>
          </div>
        ))}
        <Btn variant="ghost" className="mt-2 self-start px-3 text-[12px]" href={'/planner/season?night=' + night}>
          Open the night’s debrief
        </Btn>
      </Panel>
    </div>
  );
}
