'use client';
/* The parent board: read-only, no names, nothing tappable. It refreshes on
   its own every half minute. */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SNAPSHOT_KEY } from '@/lib/data/demo-backend';
import { demoMinistry } from '@/lib/data/seed';
import { isoDay } from '@/lib/dates';
import { boardFromMinistry, type PublicBoardData } from '@/lib/public-board';
import { fmt } from '@/lib/scoring';
import type { MinistryData } from '@/lib/types/model';

export function BoardView({ data }: { data: PublicBoardData }) {
  const top = Math.max(1, data.standings?.[0]?.total ?? 1);
  const verseText = data.verse ? data.verse.text.KJV ?? Object.values(data.verse.text)[0] : '';
  return (
    <main className="flex min-h-dvh justify-center px-4" style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--color-neutral-800) 0%, var(--color-bg) 70%)' }}>
      <div className="flex w-full max-w-[520px] flex-col gap-5 py-10">
        <div>
          <div className="text-[11px] font-semibold uppercase leading-none tracking-[.14em] text-accent-400">{data.ministry}</div>
          <h1 className="mt-2 text-[28px] font-medium leading-[1.15] text-neutral-100">
            Week {data.week} of {data.seasonWeeks}
          </h1>
          <div className="mt-1 text-[12.5px] text-neutral-500">The live board, for families. It updates on its own.</div>
        </div>
        {data.standings ? (
          <section className="sr-card flex flex-col gap-3 px-[18px] py-4">
            {data.standings.map((b, i) => (
              <div key={b.name} className="flex flex-col gap-[6px]">
                <div className="flex items-center gap-[10px]">
                  <span className="w-3 text-[12px] font-semibold text-neutral-500">{i + 1}</span>
                  <span className="h-5 w-[5px] flex-none rounded-[3px]" style={{ background: b.color }} />
                  <span className="flex-1 text-[15px] font-medium text-neutral-100">{b.name}</span>
                  <span className="tabular text-[16px] font-semibold text-neutral-100">{fmt(b.total)}</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-[3px] bg-neutral-900">
                  <div className="h-full rounded-[3px] transition-[width] duration-700" style={{ width: Math.round((b.total / top) * 100) + '%', background: b.color }} />
                </div>
              </div>
            ))}
          </section>
        ) : null}
        {data.mvp?.length ? (
          <section className="sr-card px-[18px] py-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">MVP race</div>
            <div className="flex flex-col gap-2">
              {data.mvp.map((r, i) => (
                <div key={i} className="flex items-center gap-[10px]">
                  <span className="w-3 text-[12px] font-semibold text-neutral-500">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                  <span className="flex-1 text-[14px] text-neutral-200">{r.name}</span>
                  <span className="tabular text-[13px] font-semibold text-neutral-300">{fmt(r.total)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {data.verse ? (
          <section className="sr-dark rounded-lg px-[18px] py-4" style={{ background: 'linear-gradient(165deg, var(--color-section), #1c1f3f)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-accent-300">This week’s verse · {data.verse.ref}</div>
            <div className="mt-2 text-[15px] leading-[1.6] text-neutral-100 text-pretty">{verseText}</div>
          </section>
        ) : null}
        {data.events?.length ? (
          <section className="flex flex-col gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">Coming up</div>
            {data.events.map((e, i) => (
              <div key={i} className="sr-card flex gap-3 px-4 py-3">
                <div className="w-[3px] flex-none rounded-[2px]" style={{ background: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-neutral-100">{e.title}</div>
                  <div className="mt-1 text-[11.5px] text-neutral-500">{e.meta}</div>
                </div>
                <div className="flex-none text-[11px] font-semibold text-neutral-400">{e.day ? new Date(e.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
              </div>
            ))}
          </section>
        ) : null}
        <div className="text-[11px] leading-[1.5] text-neutral-600">
          Powered by SQUAD<span className="text-accent-400">RISE</span> · nothing on this page names a student in full.
        </div>
      </div>
    </main>
  );
}

/** Supabase mode: re-ask the server every 30 seconds. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}

/** Demo mode: the board this browser's demo would publish. */
export function DemoBoard({ code }: { code: string }) {
  const [data, setData] = useState<PublicBoardData | null | 'missing'>(null);
  useEffect(() => {
    const read = () => {
      let d: MinistryData = demoMinistry();
      try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          const p = JSON.parse(raw) as MinistryData;
          d = { ...d, ...p, config: { ...d.config, ...p.config } };
        }
      } catch {
        /* the seed it is */
      }
      setData(d.config.parentCode === code ? boardFromMinistry(d, isoDay(new Date())) : 'missing');
    };
    const first = window.setTimeout(read, 0);
    const id = window.setInterval(read, 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [code]);
  if (data === null) return null;
  if (data === 'missing')
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center text-[13px] text-neutral-500">
        This board link was revoked or never existed. Ask your ministry for the current one.
      </main>
    );
  return <BoardView data={data} />;
}
