'use client';
/* The leader's console: step through the night's activities, open and
   close each one, reveal, pick what the room screen shows, and let words
   through to the cloud. The leader always sees the full results; the room
   sees what the settings allow. */
import { useState } from 'react';
import type { useLiveConsole } from '@/components/live/use-live';
import { ShowRoom } from '@/components/live/show-room';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, cx } from '@/components/ui';
import { liveType, summaryLine, timerOf, type LiveActivity, type LiveResults, type RoomView } from '@/lib/live';

type Console = ReturnType<typeof useLiveConsole>;

const VIEWS: { id: RoomView; label: string; note: string; icon: string }[] = [
  { id: 'activity', label: 'The activity', note: 'The question, the timer and, as the settings allow, the results.', icon: 'ph-presentation-chart' },
  { id: 'board', label: 'The ranks', note: 'Tonight’s full ranked list.', icon: 'ph-ranking' },
  { id: 'join', label: 'The join code', note: 'Big QR and how to get in.', icon: 'ph-qr-code' },
  { id: 'blank', label: 'Nothing', note: 'A quiet screen while you talk.', icon: 'ph-monitor' }
];

export function LiveConsole({ c, night }: { c: Console; night: string }) {
  const [picker, setPicker] = useState(false);
  const { room, cur, acts } = c;
  if (!acts.length)
    return (
      <div className="sr-card flex flex-col gap-2 px-4 py-5 text-[13px] leading-[1.5] text-neutral-400">
        <div className="text-[15px] font-medium text-neutral-100">Nothing set up for this night</div>
        Activities are planned with the night, on the desk planner’s Live ministry time.
      </div>
    );
  const left = room.open && room.endsAt ? Math.max(0, Math.ceil((room.endsAt - c.now) / 1000)) : null;
  const status = room.ended ? 'Ended' : room.open ? (left !== null ? left + 's left' : 'Open') : room.revealed ? 'Revealed' : room.opened[cur?.id ?? ''] !== undefined ? 'Closed' : room.started ? 'Ready' : 'Not started';
  const view = VIEWS.find((v) => v.id === room.view)!;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-[6px] overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {acts.map((a, i) => {
          const on = i === room.idx;
          const ran = room.opened[a.id] !== undefined;
          return (
            <button key={a.id} onClick={() => c.go(i)} aria-pressed={on} className={cx('flex min-h-11 flex-none items-center gap-[6px] rounded-full border px-3 text-[12px]', on ? 'border-accent-500 bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-accent-100' : 'border-neutral-800 text-neutral-400')}>
              <Icon name={'ph ' + (ran ? 'ph-check' : liveType(a.type).icon)} className="text-[13px]" />
              {i + 1}. {liveType(a.type).label}
            </button>
          );
        })}
      </div>

      {cur ? (
        <div className="sr-card flex flex-col gap-3 px-4 py-4">
          <div className="flex items-center gap-2 text-[11.5px] text-neutral-500">
            <span className="flex-1">
              {liveType(cur.type).label} · {timerOf(cur, c.settings) ? timerOf(cur, c.settings) + 's' : 'no timer'}
            </span>
            <span className={cx('rounded-full px-2 py-[2px] font-semibold', room.open ? 'bg-accent-600 text-white' : 'bg-neutral-800 text-neutral-300')}>{status}</span>
            <span className="tabular-nums">{c.answered} answered</span>
          </div>
          <div className="text-[17px] font-medium leading-[1.3] text-neutral-100 text-pretty">{cur.prompt}</div>
          {c.results ? <LeaderResults act={cur} r={c.results} /> : null}
          {c.pending.length ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-[.1em] text-neutral-500">Waiting on you · {c.pending.length}</div>
              {c.pending.slice(0, 12).map(([w, n]) => (
                <div key={w} className="flex items-center gap-2 text-[14px]">
                  <span className="flex-1 text-neutral-100">
                    {w}
                    {n > 1 ? <span className="text-neutral-500"> ×{n}</span> : null}
                  </span>
                  <button onClick={() => c.decide(w, true)} className="flex h-9 items-center gap-1 rounded-full border border-accent-600 px-3 text-[12px] text-accent-200" aria-label={'Show ' + w}>
                    <Icon name="ph ph-check" className="text-[12px]" /> Show
                  </button>
                  <button onClick={() => c.decide(w, false)} className="flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-3 text-[12px] text-neutral-400" aria-label={'Keep ' + w + ' off the screen'}>
                    <Icon name="ph ph-x" className="text-[12px]" /> Keep off
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {room.open ? (
              <Btn variant="secondary" className="justify-center" onClick={c.close}>
                Close now
              </Btn>
            ) : (
              <Btn className="justify-center" onClick={c.open} disabled={room.ended}>
                {room.opened[cur.id] !== undefined ? 'Open again' : 'Open'}
                {timerOf(cur, c.settings) ? ' · ' + timerOf(cur, c.settings) + 's' : ''}
              </Btn>
            )}
            <Btn variant="secondary" className="justify-center" onClick={c.reveal} disabled={room.revealed || room.opened[cur.id] === undefined || cur.type === 'cloud'}>
              Reveal
            </Btn>
            <Btn variant="ghost" className="justify-center" onClick={() => c.go(room.idx - 1)} disabled={room.idx === 0}>
              <Icon name="ph ph-caret-left" className="mr-1 text-[13px]" /> Back
            </Btn>
            <Btn variant="ghost" className="justify-center" onClick={() => c.go(room.idx + 1)} disabled={room.idx >= acts.length - 1}>
              Next <Icon name="ph ph-caret-right" className="ml-1 text-[13px]" />
            </Btn>
          </div>
        </div>
      ) : null}

      <button onClick={() => setPicker(true)} className="sr-card flex min-h-[52px] items-center gap-3 px-4 text-left">
        <Icon name={'ph ' + view.icon} className="text-[18px] text-accent-300" />
        <span className="flex-1">
          <span className="block text-[11px] text-neutral-500">Room screen shows</span>
          <span className="text-[14px] text-neutral-100">{view.label}</span>
        </span>
        <Icon name="ph ph-caret-up-down" className="text-[14px] text-neutral-500" />
      </button>
      <div className="flex flex-wrap gap-2">
        <ShowRoom night={night} />
        {room.started && !room.ended ? (
          <Btn variant="ghost" className="px-3 text-[12px]" onClick={c.end}>
            End ministry time
          </Btn>
        ) : null}
        {room.started ? (
          <Btn
            variant="ghost"
            className="px-3 text-[12px]"
            onClick={() => {
              if (window.confirm('Clear tonight’s answers and start over?')) void c.restart();
            }}
          >
            Run it again
          </Btn>
        ) : null}
      </div>
      <Sheet open={picker} onClose={() => setPicker(false)} label="What the room screen shows">
        <div className="flex flex-col gap-2 px-5 pb-6 pt-2">
          <div className="mb-1 text-[17px] font-medium text-neutral-100">The room screen shows…</div>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                c.view(v.id);
                setPicker(false);
              }}
              aria-pressed={room.view === v.id}
              className={cx('flex items-center gap-3 rounded-xl border px-4 py-3 text-left', room.view === v.id ? 'border-accent-500 bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]' : 'border-neutral-800')}
            >
              <Icon name={'ph ' + v.icon} className="text-[20px] text-accent-300" />
              <span className="flex-1">
                <span className="block text-[14px] text-neutral-100">{v.label}</span>
                <span className="text-[12px] text-neutral-500">{v.note}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** Everything the leader sees, whatever the room is allowed. */
export function LeaderResults({ act, r }: { act: LiveActivity; r: LiveResults }) {
  if (r.kind === 'choice') {
    const total = r.counts.reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="flex flex-col gap-[6px]">
        {(act.options ?? []).map((o, i) => (
          <div key={i} className="relative overflow-hidden rounded-md border border-neutral-800 px-3 py-2 text-[13px]">
            <div className="absolute inset-y-0 left-0" style={{ width: (r.counts[i] / total) * 100 + '%', background: r.correct === i ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)' : 'var(--color-neutral-800)' }} />
            <div className="relative flex gap-2">
              <span className="flex-1 text-neutral-100">
                {o.l}
                {r.correct === i ? <Icon name="ph-fill ph-check-circle" className="ml-1 text-[12px] text-accent-300" /> : null}
              </span>
              <span className="tabular-nums text-neutral-300">{r.counts[i]}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (r.kind === 'cloud') return <div className="text-[13px] leading-[1.6] text-neutral-300">{r.words.length ? r.words.map(([w, n]) => w + (n > 1 ? ' ×' + n : '')).join(' · ') : <span className="text-neutral-500">No words on the screen yet.</span>}</div>;
  return <div className="text-[13px] text-neutral-300">{summaryLine(act, r)}</div>;
}

export function LiveResultsList({ c }: { c: Console }) {
  return (
    <div className="flex flex-col gap-3">
      {!c.lines.length ? <div className="text-[12.5px] text-neutral-500">Nothing has run yet tonight.</div> : null}
      {c.lines.map((l, i) => (
        <div key={l.id} className="flex gap-3 border-t border-divider pt-3 first:border-t-0 first:pt-0">
          <span className="w-5 flex-none text-right text-[12px] tabular-nums text-neutral-500">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-neutral-500">{liveType(l.type).label}</div>
            <div className="text-[13.5px] text-neutral-100">{l.prompt}</div>
            <div className="mt-[2px] text-[12.5px] text-neutral-400">{l.line}</div>
          </div>
        </div>
      ))}
      {c.lines.length ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-divider pt-3">
          <Btn className="px-4 text-[12.5px]" onClick={c.attach}>
            {c.attached ? 'Attach again' : 'Attach to the night’s debrief'}
          </Btn>
          {c.attached ? (
            <span className="text-[11.5px] text-neutral-500">
              Attached by {c.attached.by} · {new Date(c.attached.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
