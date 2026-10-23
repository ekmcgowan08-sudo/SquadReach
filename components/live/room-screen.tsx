'use client';
/* The room screen: what the projector shows during ministry time. Drawn
   at 1280×720 and scaled to whatever holds it — a preview in the console or
   the whole TV. It only ever reads the public room snapshot, so nothing
   here can show an answer early or a word a leader hasn't approved. */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { QrCode } from '@/components/qr-code';
import { Icon, cx } from '@/components/ui';
import { liveType, type LiveResults, type LiveRoom, type RoomActivity } from '@/lib/live';

export function Scaled({ w = 1280, h = 720, fill, children, className }: { w?: number; h?: number; fill?: boolean; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const fit = () => {
      if (!fill) b.style.height = h * (b.clientWidth / w) + 'px';
      const s = Math.min(b.clientWidth / w, b.clientHeight / h);
      i.style.transform = 'scale(' + s + ')';
      i.style.left = (b.clientWidth - w * s) / 2 + 'px';
      i.style.top = (b.clientHeight - h * s) / 2 + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    return () => ro.disconnect();
  }, [w, h, fill]);
  return (
    <div ref={box} className={cx('relative w-full overflow-hidden', fill && 'h-full', className)}>
      <div ref={inner} className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h }}>
        {children}
      </div>
    </div>
  );
}

const clockLeft = (endsAt: number | null, now: number) => (endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null);

export function RoomScreen({ room, joinUrl, ministry, now }: { room: LiveRoom | null; joinUrl: string; ministry: string; now: number }) {
  if (!room || room.view === 'blank')
    return (
      <Canvas>
        <div className="flex h-full items-center justify-center text-[22px] font-medium tracking-[.2em] text-neutral-700">{ministry.toUpperCase()}</div>
      </Canvas>
    );
  if (room.view === 'join' || !room.act) return <JoinView room={room} joinUrl={joinUrl} ministry={ministry} />;
  if (room.view === 'board') return <BoardView room={room} ministry={ministry} />;
  const showQr = room.settings.qr === 'always' || !room.started;
  const left = clockLeft(room.endsAt, now);
  const main = <ActivityView act={room.act} results={room.results} revealed={room.revealed} />;
  const head = (
    <div className="flex items-center gap-4">
      <span className="rounded-full border border-neutral-700 px-4 py-[6px] text-[15px] font-medium text-neutral-300">
        <Icon name={'ph ' + liveType(room.act.type).icon} className="mr-2 text-[16px] text-accent-300" />
        {liveType(room.act.type).label} · {room.idx + 1} of {room.total}
      </span>
      <span className="flex-1" />
      <span className="text-[16px] text-neutral-400">{room.answered} answered</span>
      {left !== null ? (
        <span className={cx('flex h-[64px] w-[64px] items-center justify-center rounded-full border-[3px] text-[24px] font-semibold tabular-nums', left <= 5 ? 'border-[oklch(0.66_0.11_24)] text-[oklch(0.8_0.09_24)]' : 'border-accent-500 text-neutral-100')}>{left}</span>
      ) : room.open ? null : (
        <span className="rounded-full bg-neutral-800 px-4 py-[6px] text-[15px] text-neutral-300">{room.revealed ? 'Answer' : 'Closed'}</span>
      )}
    </div>
  );
  if (room.settings.layout === 'stage')
    return (
      <Canvas>
        <div className="flex h-full flex-col gap-6 px-[64px] py-[48px]">
          {head}
          <div className="min-h-0 flex-1">{main}</div>
          {showQr ? (
            <div className="flex items-center gap-4 self-end rounded-xl bg-neutral-900/80 p-3">
              <QrCode url={joinUrl} size={64} label="Join on your phone" />
              <div className="text-[15px] leading-[1.4] text-neutral-300">
                Join on your phone
                <div className="text-[13px] text-neutral-500">Open the app · Live</div>
              </div>
            </div>
          ) : null}
        </div>
      </Canvas>
    );
  return (
    <Canvas>
      <div className="grid h-full" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="flex min-w-0 flex-col gap-6 px-[56px] py-[44px]">
          {head}
          <div className="min-h-0 flex-1">{main}</div>
        </div>
        <div className="flex flex-col gap-5 border-l border-neutral-800 bg-neutral-950/40 px-6 py-[44px]">
          {showQr ? (
            <div className="flex flex-col items-center gap-3">
              <QrCode url={joinUrl} size={150} label="Join on your phone" />
              <div className="text-center text-[15px] leading-[1.4] text-neutral-300">
                Join on your phone
                <div className="text-[13px] text-neutral-500">Open the app · Live</div>
              </div>
            </div>
          ) : null}
          {room.settings.points === 'on' && room.board.length ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="text-[12px] font-semibold uppercase tracking-[.14em] text-neutral-500">Tonight</div>
              {room.board.slice(0, showQr ? 5 : 10).map((b, i) => (
                <div key={i} className="flex items-baseline gap-3 text-[17px]">
                  <span className="w-5 text-right tabular-nums text-neutral-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-neutral-100">{b.name}</span>
                  <span className="tabular-nums text-neutral-400">{b.pts.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Canvas>
  );
}

function Canvas({ children }: { children: ReactNode }) {
  return <div className="h-full w-full overflow-hidden bg-bg text-neutral-100">{children}</div>;
}

function JoinView({ room, joinUrl, ministry }: { room: LiveRoom; joinUrl: string; ministry: string }) {
  return (
    <Canvas>
      <div className="flex h-full items-center justify-center gap-[72px] px-[80px]">
        <div className="flex-none">
          <QrCode url={joinUrl} size={300} label="Join on your phone" />
        </div>
        <div className="flex max-w-[560px] flex-col gap-4">
          <div className="text-[15px] font-semibold uppercase tracking-[.16em] text-accent-300">{ministry}</div>
          <div className="text-[56px] font-medium leading-[1.05]">Get your phone out.</div>
          <div className="text-[22px] leading-[1.45] text-neutral-400">
            Scan this, or open the app and tap <span className="text-neutral-100">Live</span>.{room.settings.checkin === 'on' ? ' Scanning checks you in for tonight.' : ''}
          </div>
          {room.total ? <div className="text-[17px] text-neutral-500">{room.total} things tonight. Nobody’s last name goes on this screen.</div> : null}
        </div>
      </div>
    </Canvas>
  );
}

function BoardView({ room, ministry }: { room: LiveRoom; ministry: string }) {
  const rows = room.board;
  const cols = rows.length > 12 ? 2 : 1;
  return (
    <Canvas>
      <div className="flex h-full flex-col px-[72px] py-[52px]">
        <div className="text-[15px] font-semibold uppercase tracking-[.16em] text-accent-300">{ministry}</div>
        <div className="mb-6 mt-1 text-[44px] font-medium">{room.ended ? 'Tonight’s final ranks' : 'Where it stands'}</div>
        {!rows.length ? (
          <div className="text-[22px] text-neutral-500">{room.settings.points === 'on' ? 'Nobody has scored yet.' : 'Points are off tonight.'}</div>
        ) : (
          <div className="grid min-h-0 flex-1 content-start gap-x-14 gap-y-2" style={{ gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))', gridAutoFlow: 'row' }}>
            {rows.slice(0, 24).map((b, i) => (
              <div key={i} className={cx('flex items-baseline gap-4 border-b border-neutral-800 py-[6px]', i < 3 ? 'text-[26px]' : 'text-[21px]')}>
                <span className="w-9 text-right tabular-nums text-neutral-500">{i + 1}</span>
                <span className={cx('min-w-0 flex-1 truncate', i === 0 ? 'text-accent-200' : 'text-neutral-100')}>{b.name}</span>
                <span className="tabular-nums text-neutral-400">{b.pts.toLocaleString('en-US')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Canvas>
  );
}

function ActivityView({ act, results, revealed }: { act: RoomActivity; results: LiveResults | null; revealed: boolean }) {
  return (
    <div className="flex h-full flex-col gap-8">
      <div className={cx('font-medium leading-[1.15] text-pretty', act.prompt.length > 60 ? 'text-[40px]' : 'text-[48px]')}>{act.prompt}</div>
      {act.type === 'trivia' || act.type === 'this' ? <Choices act={act} results={results?.kind === 'choice' ? results : null} revealed={revealed} /> : null}
      {act.type === 'cloud' ? <Cloud results={results?.kind === 'cloud' ? results : null} /> : null}
      {act.type === 'verse' ? <Verse act={act} results={results?.kind === 'verse' ? results : null} /> : null}
      {act.type === 'tug' ? <Tug act={act} results={results?.kind === 'tug' ? results : null} /> : null}
    </div>
  );
}

function Choices({ act, results, revealed }: { act: RoomActivity; results: Extract<LiveResults, { kind: 'choice' }> | null; revealed: boolean }) {
  const total = results ? results.counts.reduce((a, b) => a + b, 0) || 1 : 1;
  const two = (act.options?.length ?? 0) <= 2;
  return (
    <div className={cx('grid gap-4', two ? 'grid-cols-2' : 'grid-cols-1')}>
      {(act.options ?? []).map((o, i) => {
        const pct = results ? Math.round((results.counts[i] / total) * 100) : 0;
        const right = revealed && results?.correct === i;
        const dim = revealed && results?.correct !== null && results?.correct !== undefined && !right;
        return (
          <div key={i} className={cx('relative overflow-hidden rounded-xl border-2', two ? 'px-7 py-8' : 'px-6 py-[14px]')} style={{ borderColor: right ? 'var(--color-accent-300)' : 'color-mix(in srgb, var(--color-text) 16%, transparent)' }}>
            {results ? <div className="absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: pct + '%', background: right ? 'var(--color-accent)' : dim ? 'var(--color-neutral-800)' : 'color-mix(in srgb, var(--color-accent) 45%, transparent)' }} /> : null}
            <div className={cx('relative flex items-center gap-4', dim ? 'text-neutral-500' : 'text-neutral-100')}>
              <span className={cx('flex-1 font-medium', two ? 'text-[36px]' : 'text-[26px]')}>{o}</span>
              {right ? <Icon name="ph-fill ph-check-circle" className="text-[30px]" /> : null}
              {results ? <span className={cx('tabular-nums', two ? 'text-[32px]' : 'text-[24px]')}>{pct}%</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cloud({ results }: { results: Extract<LiveResults, { kind: 'cloud' }> | null }) {
  const words = results?.words ?? [];
  if (!words.length) return <div className="text-[24px] text-neutral-500">Words show up here once a leader lets them through.</div>;
  const max = Math.max(...words.map((w) => w[1]));
  const order = [...words].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <div className="flex flex-wrap content-start items-baseline gap-x-8 gap-y-3">
      {order.map(([w, n]) => (
        <span key={w} className="font-medium leading-none transition-all" style={{ fontSize: 22 + 54 * (n / max), color: n === max ? 'var(--color-accent-200)' : n / max > 0.5 ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
          {w}
        </span>
      ))}
    </div>
  );
}

function Verse({ act, results }: { act: RoomActivity; results: Extract<LiveResults, { kind: 'verse' }> | null }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="text-[36px] leading-[1.5] text-neutral-300 text-pretty">
        {(act.verse ?? []).map((p, i) => {
          if (!p.blank) return <span key={i}>{p.t}</span>;
          return (
            <span key={i} className="mx-1 border-b-[3px] border-accent-500 px-1 font-medium text-accent-200">
              {p.t}
            </span>
          );
        })}
      </div>
      {results && results.total ? (
        <div className="flex flex-wrap gap-6 text-[20px] text-neutral-400">
          {results.blanks.map((x, i) => (
            <span key={i}>
              Blank {i + 1}: <span className="text-neutral-100">{Math.round((x.right / results.total) * 100)}%</span> got it
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Tug({ act, results }: { act: RoomActivity; results: Extract<LiveResults, { kind: 'tug' }> | null }) {
  const sides = act.sides ?? ['Left side', 'Right side'];
  const taps = results?.taps ?? [0, 0];
  const t = taps[0] + taps[1];
  const share = t ? taps[0] / t : 0.5;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between text-[30px] font-medium">
        <span>{sides[0]}</span>
        <span>{sides[1]}</span>
      </div>
      <div className="relative h-[72px] overflow-hidden rounded-full bg-neutral-900">
        <div className="absolute inset-y-0 left-0 transition-[width] duration-300" style={{ width: share * 100 + '%', background: 'oklch(0.63 0.1 292)' }} />
        <div className="absolute inset-y-0 right-0 transition-[width] duration-300" style={{ width: (1 - share) * 100 + '%', background: 'oklch(0.63 0.1 208)' }} />
        <div className="absolute inset-y-[-6px] left-1/2 w-[4px] -translate-x-1/2 bg-white/80" />
      </div>
      <div className="flex justify-between text-[24px] tabular-nums text-neutral-400">
        <span>{taps[0].toLocaleString('en-US')} taps</span>
        <span>{taps[1].toLocaleString('en-US')} taps</span>
      </div>
    </div>
  );
}
