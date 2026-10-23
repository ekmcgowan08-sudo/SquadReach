'use client';
/* Screens around the night: sending points in for approval, the attendance
   map, and the read-only parent board link. */
import { useRef, useState } from 'react';
import { useStandings } from '@/components/dashboard/standings-list';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { verseForWeek } from '@/lib/bible';
import { shrinkImage } from '@/lib/image';
import { fmt, pointBase } from '@/lib/scoring';
import { myTeamId, teamOf, teamRoster } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { ParentShare } from '@/lib/types/model';

const kicker = 'text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500';
const chip = (on: boolean, color?: string) => ({
  borderColor: on ? color ?? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, ' + (color ?? 'var(--color-accent)') + ' 16%, transparent)' : 'transparent',
  color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)'
});

/* ── SUBMIT POINTS — captains and coaches send, a leader approves ──────── */
export function SubmitPointsScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const base = pointBase(d.config);
  const [team, setTeam] = useState<string | null>(myTeamId(m, d, coachTeam));
  const [cat, setCat] = useState(d.cats[0]?.id ?? 'general');
  const [amount, setAmount] = useState(0);
  const [why, setWhy] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await shrinkImage(f));
    } catch (e) {
      api().say((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (!team) {
      api().say('Pick a squad first.');
      return;
    }
    if (!amount) {
      api().say('Add an amount.');
      return;
    }
    const flag = api().award({ team, cat, amount, why: why.trim() || (photo ? 'Submitted with photo proof' : 'Submitted for approval'), detail: photo ? { photo, proof: true } : null });
    if (!flag) return;
    api().logActivity(m.displayName + ' submitted ' + fmt(amount) + ' points for ' + teamOf(d, team).name + (photo ? ' with photo proof' : ''));
    api().sayPosted('Sent for approval' + (photo ? ' with proof.' : '.'), 'Held until you have signal, then it goes to approval.');
    setAmount(0);
    setWhy('');
    setPhoto(null);
  };

  return (
    <Screen label="Submit Points">
      <ScreenHeader title="Submit points" sub="Captains and coaches send, a leader approves" back="/dashboard/more" />
      <div className={kicker}>Squad</div>
      <div className="flex flex-wrap gap-[6px]">
        {d.teams.map((t) => (
          <button key={t.id} onClick={() => setTeam(t.id)} aria-pressed={team === t.id} className="flex min-h-11 items-center gap-[7px] rounded-full border px-[13px] text-[12px] font-medium leading-none" style={chip(team === t.id, t.color)}>
            <span className="h-[9px] w-[9px] rounded-full" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
      </div>
      <div className={kicker}>Category</div>
      <div className="flex flex-wrap gap-[6px]">
        {d.cats.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className="min-h-11 rounded-full border px-3 text-[11.5px] font-medium leading-none" style={chip(cat === c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-[10px] rounded-lg bg-neutral-900 px-[13px] py-3" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
        <div className="flex-1">
          <div className="tabular text-[22px] font-semibold leading-none text-neutral-100">{fmt(amount)}</div>
          <div className="mt-1 text-[10px] leading-[1.4] text-neutral-500">Steps of {fmt(base)} — tonight’s point base</div>
        </div>
        <button aria-label="Subtract" onClick={() => setAmount((a) => Math.max(0, a - base))} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
          <Icon name="ph ph-minus" className="text-[14px]" />
        </button>
        <button aria-label="Add" onClick={() => setAmount((a) => a + base)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-accent-600 text-accent-100" style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)' }}>
          <Icon name="ph ph-plus" className="text-[14px]" />
        </button>
      </div>
      <label className="field">
        <span className="sr-label">What happened</span>
        <textarea value={why} onChange={(e) => setWhy(e.target.value)} className="input !min-h-14" placeholder="Ellison brought two friends and both stayed for small group" />
      </label>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <div className="flex items-center gap-[10px]">
        {photo ? <div className="h-14 w-14 flex-none rounded-md bg-neutral-900 bg-cover bg-center" style={{ backgroundImage: 'url(' + photo + ')', boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }} /> : null}
        <Btn variant="secondary" className="min-h-[46px] flex-1 justify-center" onClick={() => fileRef.current?.click()}>
          <Icon name={busy ? 'ph ph-circle-notch' : 'ph ph-camera'} className={'mr-[6px] text-[14px]' + (busy ? ' animate-sr-spin' : '')} />
          {photo ? 'Retake photo proof' : 'Attach photo proof'}
        </Btn>
        {photo ? (
          <button aria-label="Remove the photo" onClick={() => setPhoto(null)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-600">
            <Icon name="ph ph-trash" className="text-[13px]" />
          </button>
        ) : null}
      </div>
      <Btn className="min-h-[50px] justify-center" onClick={send}>
        {amount ? 'Send ' + fmt(amount) + ' for approval' : 'Send for approval'}
      </Btn>
      <div className="text-[10.5px] leading-[1.6] text-neutral-500 text-pretty">The photo rides along to the approval queue, so a leader can see the proof before the points land.</div>
    </Screen>
  );
}

/* ── ATTENDANCE MAP — percent of each roster present, week by week ─────── */
export function AttendanceScreen() {
  const d = useApp((s) => s.data);
  const wk = d.config.weekNumber;
  const weeks = d.config.seasonWeeks;
  const rows = d.teams.map((t) => {
    const roster = teamRoster(d, t.id).length;
    const tonight = roster ? Math.round((teamRoster(d, t.id).filter((r) => d.tonight.presence[r.name]).length / roster) * 100) : 0;
    const hist = d.attendanceHistory[t.id] ?? [];
    const cells = Array.from({ length: weeks }, (_, i) => {
      const n = i + 1;
      if (n > wk) return null;
      /* Tonight reads live presence once anyone is checked in. */
      return n === wk && tonight ? tonight : hist[i] ?? 0;
    });
    const seen = cells.filter((c): c is number => c != null && c > 0);
    const avg = seen.length ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : 0;
    return { t, roster, cells, avg };
  });
  const best = [...rows].filter((r) => r.roster).sort((a, b) => b.avg - a.avg)[0];
  return (
    <Screen label="Attendance">
      <ScreenHeader title="Attendance map" sub="Percent of each roster present, week by week" back="/dashboard/more" />
      <div className="flex flex-col gap-[7px]">
        <div className="flex gap-[3px] pl-[74px]">
          {Array.from({ length: weeks }, (_, i) => (
            <div key={i} className="flex-1 text-center text-[9px] font-medium leading-none" style={{ color: i + 1 === wk ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
              {i + 1}
            </div>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.t.id} className="flex items-center gap-[3px]">
            <div className="flex w-[71px] flex-none items-center gap-[6px]">
              <span className="h-[18px] w-[5px] flex-none rounded-[3px]" style={{ background: r.t.color }} />
              <span className="truncate text-[11px] font-medium leading-[1.1] text-neutral-300">{r.t.name}</span>
            </div>
            {r.cells.map((c, i) => (
              <div
                key={i}
                title={c == null ? 'Week ' + (i + 1) + ' · coming up' : 'Week ' + (i + 1) + ' · ' + c + '%'}
                className="flex aspect-square flex-1 items-center justify-center rounded-[4px] text-[8px] font-medium leading-none"
                style={{
                  border: i + 1 === wk ? '1px solid var(--color-accent-400)' : c == null ? '1px dashed var(--color-neutral-800)' : '1px solid transparent',
                  background: c == null ? 'transparent' : 'color-mix(in srgb, ' + r.t.color + ' ' + Math.round(c * 0.62) + '%, var(--color-neutral-900))',
                  color: c != null && c > 55 ? '#fff' : 'var(--color-neutral-400)'
                }}
              >
                {c ? c : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.t.id} className="flex items-center gap-[9px] rounded-md bg-neutral-900 px-[11px] py-[9px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
            <span className="h-[22px] w-[5px] flex-none rounded-[3px]" style={{ background: r.t.color }} />
            <span className="flex-1 text-[12.5px] font-medium leading-[1.2] text-neutral-200">{r.t.name}</span>
            <span className="text-[10.5px] leading-none text-neutral-500">{r.roster ? r.roster + ' students' : 'roster not imported'}</span>
            <span className="text-[13px] font-semibold leading-none text-accent-200">{r.roster ? r.avg + '%' : '—'}</span>
          </div>
        ))}
      </div>
      <div className="text-[10.5px] leading-[1.6] text-neutral-500 text-pretty">
        {best ? best.t.name + ' shows up most — ' + best.avg + '% on average' : 'No check-ins yet'}. Past weeks read from check-in records; the outlined column is tonight.
      </div>
    </Screen>
  );
}

/* ── PARENT LINK — the read-only public board, and what's on it ────────── */
const SHARE_ROWS: { id: keyof ParentShare; label: string; hint: string }[] = [
  { id: 'standings', label: 'Live standings', hint: 'squad points only' },
  { id: 'mvp', label: 'MVP race', hint: 'first names only' },
  { id: 'verse', label: 'Memory verse', hint: 'this week' },
  { id: 'photos', label: 'Week photos', hint: 'off by default' },
  { id: 'calendar', label: 'Calendar', hint: 'public events' }
];

export function newParentCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'SR-' + Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export function ParentLinkScreen() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const rows = useStandings();
  const [preview, setPreview] = useState(false);
  const share = d.config.parentShare;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = origin + '/b/' + d.config.parentCode;
  const top = rows[0]?.total || 1;
  const verse = verseForWeek(d.config.memoryVerses, d.config.weekNumber);

  const saveConfig = (fn: (c: typeof d.config) => void) => {
    api().mutate((x) => fn(x.config));
    api().emit({ kind: 'config', config: api().data.config });
  };

  return (
    <Screen label="Parent Link">
      <ScreenHeader title="Parent board link" sub="Read-only. No names, no logins, no app install" back="/dashboard/more" />
      <div className="sr-card flex flex-col gap-[11px] px-[15px] py-[14px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-400">Live link</div>
        <div className="break-all text-[15px] font-medium leading-[1.3] text-neutral-100">{url.replace(/^https?:\/\//, '')}</div>
        <div className="flex gap-[7px]">
          <Btn
            className="flex-1 justify-center"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(
                () => api().say('Link copied.'),
                () => api().say('Copy is blocked here — press and hold the link to copy it.')
              );
            }}
          >
            <Icon name="ph ph-copy" className="mr-[6px] text-[14px]" />
            Copy link
          </Btn>
          <Btn variant="ghost" className="flex-none px-[13px]" href={'/b/' + d.config.parentCode}>
            Open
          </Btn>
          <Btn
            variant="ghost"
            className="flex-none px-[13px]"
            onClick={() => {
              saveConfig((c) => void (c.parentCode = newParentCode()));
              api().logActivity('Regenerated the parent board link');
              api().say('Old link revoked — the new one is live.');
            }}
          >
            Revoke
          </Btn>
        </div>
      </div>

      <div className={kicker}>What parents see</div>
      <div className="flex flex-col gap-[7px]">
        {SHARE_ROWS.map((r) => {
          const on = share[r.id];
          return (
            <button
              key={r.id}
              onClick={() => saveConfig((c) => void (c.parentShare = { ...c.parentShare, [r.id]: !c.parentShare[r.id] }))}
              aria-pressed={on}
              className="flex min-h-12 items-center gap-[11px] rounded-md border bg-neutral-900 px-3 text-left"
              style={{ borderColor: on ? 'var(--color-accent-800)' : 'var(--color-neutral-800)' }}
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border text-accent-100" style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-700)', background: on ? 'color-mix(in srgb, var(--color-accent) 24%, transparent)' : 'transparent' }}>
                <Icon name={on ? 'ph-fill ph-check' : 'ph ph-minus'} className="text-[11px]" />
              </span>
              <span className="flex-1 text-[12.5px] font-medium leading-[1.2]" style={{ color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-500)' }}>
                {r.label}
              </span>
              <span className="text-[10px] leading-[1.3] text-neutral-500">{r.hint}</span>
            </button>
          );
        })}
      </div>

      <Btn variant="secondary" className="justify-center" onClick={() => setPreview((v) => !v)}>
        {preview ? 'Hide the preview' : 'Preview what parents see'}
      </Btn>
      {preview ? (
        <div className="flex animate-[sr-rise_.22s_ease_both] flex-col gap-3 rounded-lg p-[15px]" style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--color-neutral-800), var(--color-bg) 70%)', boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.14em] text-accent-400">Parent view</div>
          {share.standings ? (
            <div className="flex flex-col gap-[9px]">
              {rows.map((b, i) => (
                <div key={b.id} className="flex flex-col gap-[6px]">
                  <div className="flex items-center gap-[9px]">
                    <span className="w-3 text-[11px] font-semibold leading-none text-neutral-500">{i + 1}</span>
                    <span className="h-[18px] w-[5px] flex-none rounded-[3px]" style={{ background: b.color }} />
                    <span className="flex-1 text-[13px] font-medium leading-[1.1] text-neutral-100">{b.name}</span>
                    <span className="tabular text-[13px] font-semibold leading-none text-neutral-200">{fmt(b.total)}</span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-[3px] bg-neutral-900">
                    <div className="h-full rounded-[3px]" style={{ width: Math.round((b.total / top) * 100) + '%', background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {share.verse && verse ? (
            <div className="border-t border-divider pt-[11px]">
              <div className="mb-[6px] text-[9.5px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">This week’s verse · {verse.ref}</div>
              <div className="text-[11.5px] leading-[1.6] text-neutral-400 text-pretty">{verse.text.KJV ?? Object.values(verse.text)[0]}</div>
            </div>
          ) : null}
          <div className="text-[10px] leading-[1.5] text-neutral-500">Nothing on this page is tappable for parents — it refreshes on its own.</div>
        </div>
      ) : null}
    </Screen>
  );
}
