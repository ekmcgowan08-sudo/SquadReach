'use client';
/* Small pieces the night-cycle screens share. */
import type { ReactNode } from 'react';
import { usePreviewPick } from '@/components/cycle/use-cycle';
import { Icon, Label, cx } from '@/components/ui';
import { dayLabel, clock, type NightTimes } from '@/lib/cycle';

/** Demo only: "Preview as of" — the week at another moment. */
export function PreviewClock({ t, stages, current, mode }: { t: NightTimes; stages: { id: string; short: string; at: number }[]; current: string | null; mode: 'demo' | 'supabase' }) {
  const pick = usePreviewPick();
  if (mode !== 'demo') return null;
  const cur = stages.find((s) => s.id === current);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <Label>Preview as of · {cur ? dayLabel(cur.at) + ' · ' + clock(cur.at) : 'now'}</Label>
        {cur ? (
          <button onClick={() => pick(null, t)} className="text-[11px] text-accent-300">
            Back to now
          </button>
        ) : null}
      </div>
      <div className="-mx-[18px] flex gap-[6px] overflow-x-auto px-[18px] pb-[2px]" style={{ scrollbarWidth: 'none' }}>
        {stages.map((g) => {
          const on = g.id === current;
          return (
            <button
              key={g.id}
              onClick={() => pick(on ? null : g.id, t)}
              aria-pressed={on}
              className="min-h-9 flex-none rounded-full border px-3 text-[11.5px] font-medium leading-none"
              style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
            >
              {g.short}
            </button>
          );
        })}
      </div>
      <div className="mt-[6px] text-[10.5px] leading-[1.4] text-neutral-600">Demo clock. A real ministry runs on real time.</div>
    </div>
  );
}

/** A segmented row: two to four short options. */
export function Seg<T extends string>({ value, options, onChange, small }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="flex gap-[6px] rounded-full bg-neutral-900 p-1" role="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={cx('flex-1 rounded-full font-medium leading-none', small ? 'min-h-9 text-[11.5px]' : 'min-h-10 text-[12.5px]')}
            style={{ background: on ? 'var(--color-neutral-800)' : 'transparent', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-500)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A round tick: the attendance and follow-up rows. */
export function Tick({ on, locked, size = 22 }: { on: boolean; locked?: boolean; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full border"
      style={{ width: size, height: size, borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-600)', background: on ? 'var(--color-accent-500)' : 'transparent' }}
    >
      <Icon name={locked ? 'ph-fill ph-lock-simple' : 'ph ph-check'} className="text-[11px]" style={{ color: locked ? 'var(--color-neutral-500)' : on ? 'var(--color-bg)' : 'transparent' }} />
    </span>
  );
}

/** A selectable person chip with an availability tag. */
export function PersonChip({ name, on, tag, onClick }: { name: string; on: boolean; tag?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="min-h-9 flex-none rounded-full border px-3 text-[11.5px] font-medium leading-none"
      style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-700)', background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-300)' }}
    >
      {name}
      {tag ? <span className="ml-1 font-normal text-neutral-500">· {tag}</span> : null}
    </button>
  );
}
