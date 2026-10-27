'use client';
/* One value per week as columns: thin marks with a rounded data-end and
   a square baseline, a hairline baseline, the highest and the latest
   week labelled (never every bar), the rest on hover or focus, and a
   table for screen readers. One series, so no legend: the title says
   what it is. */
import { useState } from 'react';
import type { WeekValue } from '@/lib/report-views';

export function WeekBars({ weeks, label, format = (v) => String(v), color = 'var(--color-accent-500)', height = 110 }: { weeks: WeekValue[]; label: string; format?: (v: number) => string; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!weeks.length) return <p className="text-[12.5px] text-neutral-500">Nothing yet — the first night hasn’t happened.</p>;
  const max = Math.max(1, ...weeks.map((w) => w.value));
  const top = weeks.reduce((a, w) => (w.value > a.value ? w : a), weeks[0]);
  const last = weeks[weeks.length - 1];
  const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <figure className="relative m-0">
      <div className="flex items-end gap-[2px] border-b border-neutral-800" style={{ height: height + 18 }} onPointerLeave={() => setHover(null)}>
        {weeks.map((w, i) => {
          const h = w.value > 0 ? Math.max(2, Math.round((w.value / max) * height)) : 0;
          const show = w === top || w === last;
          return (
            <div
              key={w.week}
              tabIndex={0}
              role="img"
              aria-label={'Week ' + w.week + ': ' + format(w.value)}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {show ? <span className="tabular mb-[3px] whitespace-nowrap text-[10.5px] text-neutral-300">{format(w.value)}</span> : null}
              <span className="block w-full max-w-[24px] rounded-t-[4px] transition-[filter]" style={{ height: h, background: color, filter: hover === i ? 'brightness(1.18)' : undefined }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px]" aria-hidden>
        {weeks.map((w) => (
          <span key={w.week} className="flex-1 text-center text-[10px] text-neutral-500">
            W{w.week}
          </span>
        ))}
      </div>
      {hover !== null && weeks[hover] ? (
        <div role="tooltip" className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-neutral-800 bg-surface px-3 py-2 shadow-lg" style={{ left: ((hover + 0.5) / weeks.length) * 100 + '%' }}>
          <div className="tabular text-[13px] font-semibold text-neutral-100">{format(weeks[hover].value)}</div>
          <div className="text-[11px] text-neutral-400">
            Week {weeks[hover].week} · {day(weeks[hover].date)}
          </div>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week}>
              <th scope="row">Week {w.week}</th>
              <td>{format(w.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
