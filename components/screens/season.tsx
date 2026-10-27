'use client';
/* SEASON — every week and what runs in it, and the small-group guides a
   coach plays for their squad after the game. Plus Badges & Streaks. */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ytEmbedUrl } from '@/components/screens/games';
import { PictureEditor, PictureFill, PictureFrame } from '@/components/screens/sg-picture';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader, initialsOf, tint } from '@/components/ui';
import { kindOf } from '@/lib/library';
import { ideasFor, screenFrom } from '@/lib/small-group-ideas';
import { sgForTeam } from '@/lib/small-groups';
import { challengesIn, runningIn } from '@/lib/feeds';
import { canApprove, canScore } from '@/lib/permissions';
import { TIER_COLOR, catOf, computeBadges, eventLabel, myTeamId, teamOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { SmallGroup, SmallGroupScreen } from '@/lib/types/model';
import { useOverlayHost } from '@/lib/use-overlay-host';
import { useNow } from '@/lib/use-now';

export const SG_TYPES = [
  { id: 'thought', label: 'Fun thought', icon: 'ph ph-lightbulb', color: '#e0a23f', bg: 'radial-gradient(circle at 30% 20%, #3a2f1a, #17181f)', secs: 90 },
  { id: 'scripture', label: 'Scripture', icon: 'ph ph-book-bookmark', color: '#4f9fd6', bg: 'radial-gradient(circle at 30% 20%, #16283a, #17181f)', secs: 120 },
  { id: 'game', label: 'Game', icon: 'ph ph-game-controller', color: '#78b579', bg: 'radial-gradient(circle at 30% 20%, #1a3320, #17181f)', secs: 240 },
  { id: 'pass', label: 'Pass the phone', icon: 'ph ph-hand-arrow-up', color: '#968ae0', bg: 'radial-gradient(circle at 30% 20%, #2a2440, #17181f)', secs: 90 },
  { id: 'poll', label: 'Live poll', icon: 'ph ph-chart-bar', color: '#d97a9e', bg: 'radial-gradient(circle at 30% 20%, #3a1a2c, #17181f)', secs: 75 },
  { id: 'checklist', label: 'Hands-on activity', icon: 'ph ph-check-square', color: '#5fbfae', bg: 'radial-gradient(circle at 30% 20%, #123330, #17181f)', secs: 150 },
  { id: 'video', label: 'Video', icon: 'ph ph-play-circle', color: '#e07a5f', bg: 'radial-gradient(circle at 30% 20%, #3a2018, #17181f)', secs: 180 },
  { id: 'spinner', label: 'Spinner', icon: 'ph ph-target', color: '#f0c14f', bg: 'radial-gradient(circle at 30% 20%, #3a2f10, #17181f)', secs: 60 },
  { id: 'timer', label: 'Countdown', icon: 'ph ph-timer', color: '#6fc2e0', bg: 'radial-gradient(circle at 30% 20%, #10303a, #17181f)', secs: 120 },
  { id: 'prayer', label: 'Prayer requests', icon: 'ph ph-hands-praying', color: '#c98fd6', bg: 'radial-gradient(circle at 30% 20%, #2f1a3a, #17181f)', secs: 180 },
  { id: 'wyr', label: 'Would you rather', icon: 'ph ph-scales', color: '#e0854f', bg: 'radial-gradient(circle at 30% 20%, #3a2010, #17181f)', secs: 75 }
] as const;
const typeOf = (id: string) => SG_TYPES.find((t) => t.id === id) ?? SG_TYPES[0];
export const sgMinutes = (screens: SmallGroupScreen[]) =>
  Math.max(1, Math.round(screens.reduce((n, s) => n + (s.type === 'timer' ? s.timerSeconds ?? 120 : typeOf(s.type).secs), 0) / 60));
const SPIN = ['#e0a23f', '#4f9fd6', '#78b579', '#968ae0', '#d97a9e', '#5fbfae', '#e07a5f', '#f0d75f'];

const pillTabs = (on: boolean) => ({ background: on ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' });

export function SeasonScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'groups' ? 'groups' : 'weeks';
  const m = useApp((s) => s.membership);
  const [editing, setEditing] = useState<SmallGroup | null>(null);
  return (
    <Screen label={tab === 'groups' ? 'Small groups' : 'Season plan'} gap={13}>
      <ScreenHeader
        title={tab === 'groups' ? 'Small Groups' : 'Season'}
        back="/dashboard/more"
        right={
          tab === 'groups' && canApprove(m.persona) ? (
            <button aria-label="New small group" onClick={() => setEditing({ id: uid(), title: '', notes: '', screens: [], weekNumber: 1 })} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-accent-600 text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
              <Icon name="ph ph-plus" className="text-[14px]" />
            </button>
          ) : undefined
        }
      />
      <div className="flex gap-1 self-start rounded-full border border-neutral-800 bg-neutral-900 p-[3px]">
        {(['weeks', 'groups'] as const).map((t) => (
          <button key={t} onClick={() => router.replace('/dashboard/season-plan' + (t === 'groups' ? '?tab=groups' : ''))} aria-pressed={tab === t} className="min-h-11 rounded-full px-[15px] text-[12px] font-medium leading-none" style={pillTabs(tab === t)}>
            {t === 'weeks' ? 'Weeks' : 'Small groups'}
          </button>
        ))}
      </div>
      {tab === 'weeks' ? <Weeks /> : <Groups onEdit={setEditing} />}
      {editing ? <GroupEditor key={editing.id} group={editing} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}

function Weeks() {
  const d = useApp((s) => s.data);
  const c = d.config;
  const weeks = Array.from({ length: c.seasonWeeks }, (_, i) => {
    const w = i + 1;
    const iso = c.meetingDates[i];
    const next = c.meetingDates[i + 1];
    const items: { icon: string; color: string; label: string; kind: string }[] = [];
    /* One game runs the whole season, on the weeks it's set for. */
    if (c.gameName && (!c.gameSetup.gameWeeks || c.gameSetup.gameWeeks.includes(w))) items.push({ icon: 'ph ph-timer', color: catOf(d, 'games').color, label: c.gameName, kind: 'Game' });
    const v = c.memoryVerses.find((x) => x.week === w);
    if (v) items.push({ icon: 'ph ph-book-open-text', color: catOf(d, 'bible').color, label: v.ref, kind: 'Memory verse' });
    for (const g of d.smallGroups.filter((x) => x.weekNumber === w)) items.push({ icon: 'ph ph-users-four', color: 'var(--color-accent-400)', label: g.title, kind: 'Small group' });
    for (const p of d.libraryPlaced.filter((x) => x.week === w)) items.push({ icon: kindOf(p.kind).icon, color: 'var(--color-accent-300)', label: p.title, kind: 'From the library' });
    for (const ch of challengesIn(d.challenges, w)) items.push({ icon: 'ph ph-target', color: catOf(d, 'visitors').color, label: ch.title, kind: ch.kind + ' challenge' });
    for (const sp of runningIn(c.mediaSpots ?? [], w)) items.push({ icon: 'ph ph-film-strip', color: sp.color, label: sp.title, kind: sp.kind });
    if (iso) for (const e of d.events.filter((x) => x.status !== 'proposed' && x.iso && x.iso > iso && (!next || x.iso < next))) items.push({ icon: 'ph ph-calendar-dots', color: e.color, label: e.title + ' · ' + eventLabel(e), kind: 'Event' });
    const date = iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return { w, date, items, now: w === c.weekNumber, past: w < c.weekNumber };
  });
  return (
    <>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Every week of the season and what runs in it — the game, the verse, the small group, the challenges, the media spots and anything on the calendar in between.</div>
      <div className="flex flex-col gap-[9px]">
        {weeks.map((w) => (
          <div key={w.w} className="rounded-lg bg-surface px-[14px] py-3" style={{ boxShadow: w.now ? 'inset 0 0 0 1px var(--color-accent-600)' : 'var(--shadow-sm)', opacity: w.past ? 0.72 : 1 }}>
            <div className="flex items-center gap-2">
              <div className="text-[13.5px] font-medium leading-none text-neutral-100">Week {w.w}</div>
              <div className="text-[11.5px] leading-none text-neutral-500">{w.date}</div>
              {w.now ? <span className="rounded-full border border-accent-600 px-[7px] py-1 text-[9px] font-semibold uppercase leading-none tracking-[.1em] text-accent-200">Tonight</span> : null}
              <span className="ml-auto text-[10.5px] leading-none text-neutral-500">{w.items.length === 1 ? '1 thing' : w.items.length + ' things'}</span>
            </div>
            {w.items.length ? (
              <div className="mt-[10px] flex flex-col gap-[7px]">
                {w.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-[9px]">
                    <Icon name={it.icon} className="flex-none text-[14px]" style={{ color: it.color }} />
                    <div className="min-w-0 flex-1 truncate text-[12px] leading-[1.3] text-neutral-200">{it.label}</div>
                    <span className="flex-none text-[9.5px] uppercase leading-none tracking-[.06em] text-neutral-500">{it.kind}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[11px] leading-[1.4] text-neutral-500">Nothing scheduled yet.</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function saveGroups(api: ReturnType<typeof useAppApi>, fn: (list: SmallGroup[]) => SmallGroup[]) {
  api().mutate((x) => void (x.smallGroups = fn(x.smallGroups)));
  api().emit({ kind: 'doc', key: 'smallGroups', value: api().data.smallGroups });
}

function Groups({ onEdit }: { onEdit: (g: SmallGroup) => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const [playing, setPlaying] = useState<SmallGroup | null>(null);
  const [deep, setDeep] = useState<string | null>(null);
  const coachTeam = useApp((s) => s.coachTeam);
  const edit = canApprove(m.persona);
  const mine = myTeamId(m, d, coachTeam);
  const groups = [...d.smallGroups].filter((g) => edit || sgForTeam(g, mine)).sort((a, b) => b.weekNumber - a.weekNumber);
  return (
    <>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Discussion guides for after-game small group time. Coaches and captains open these to lead their squad — they’re saved on this phone with everything else, so they play without signal (videos need it).</div>
      {groups.length ? (
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const dd = g.deepDive;
            const open = deep === g.id;
            const approved = dd ? d.deepSubs.filter((s) => s.groupId === g.id && s.status === 'approved').length : 0;
            return (
              <div key={g.id} className="sr-card flex flex-col gap-[6px] px-[15px] py-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13.5px] font-medium leading-[1.3] text-neutral-100">{g.title}</div>
                  <span className="flex-none whitespace-nowrap pt-[2px] text-[9.5px] font-semibold uppercase leading-none tracking-[.08em] text-neutral-500">Week {g.weekNumber}</span>
                </div>
                {g.notes ? <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">{g.notes}</div> : null}
                {g.teams?.length ? <div className="text-[10.5px] leading-none text-accent-300">For {g.teams.map((t) => teamOf(d, t).name).join(', ')}</div> : null}
                <div className="text-[10.5px] leading-none text-neutral-500">
                  {g.screens.length} {g.screens.length === 1 ? 'screen' : 'screens'} · about {sgMinutes(g.screens)} min
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {g.screens.length ? (
                    <Btn className="px-3" onClick={() => setPlaying(g)}>
                      <Icon name="ph ph-play" className="mr-[5px] text-[13px]" />
                      Play · {g.screens.length}
                    </Btn>
                  ) : null}
                  {dd ? (
                    <button onClick={() => setDeep(open ? null : g.id)} aria-expanded={open} className="flex min-h-11 items-center gap-[6px] rounded-md border border-accent-600 px-3 text-[12px] font-medium leading-none text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}>
                      <Icon name="ph ph-book-open-text" className="text-[13px]" />
                      Go deeper
                    </button>
                  ) : null}
                  {edit ? (
                    <>
                      <Btn variant="secondary" className="px-3" onClick={() => onEdit(g)}>
                        Edit
                      </Btn>
                      <Btn
                        variant="ghost"
                        className="px-3"
                        onClick={() => {
                          if (!window.confirm('Remove “' + g.title + '”?')) return;
                          saveGroups(api, (list) => list.filter((x) => x.id !== g.id));
                          api().logActivity('Removed the small group “' + g.title + '”');
                        }}
                      >
                        Remove
                      </Btn>
                    </>
                  ) : null}
                </div>
                {dd && open ? (
                  <div className="mt-1 flex flex-col gap-[10px] rounded-md border border-accent-700 p-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}>
                    <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-100">{dd.title}</div>
                    <div className="text-[11.5px] leading-[1.55] text-neutral-400 text-pretty">{dd.studentAsk}</div>
                    <div className="flex flex-col gap-[3px] border-l-2 border-accent-500 pl-[10px]">
                      <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.08em] text-accent-300">Memory verse · {dd.verseRef}</div>
                      <div className="text-[11.5px] leading-[1.5] text-neutral-300 text-pretty">{dd.verseText}</div>
                    </div>
                    {dd.days.map((day, i) => (
                      <div key={i} className="flex items-start gap-[9px]">
                        <Icon name="ph ph-book-open" className="mt-[1px] flex-none text-[16px] text-accent-300" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-medium leading-[1.3] text-neutral-200">
                            {day.day} · {day.ref}
                          </div>
                          <div className="mt-[2px] text-[11px] leading-[1.5] text-neutral-500 text-pretty">{day.prompt}</div>
                        </div>
                      </div>
                    ))}
                    <div className="text-[10.5px] leading-none text-neutral-500">{approved} responses approved so far — review them on Races.</div>
                    {canScore(m.persona) ? (
                      <div className="flex flex-col gap-1 border-t border-divider pt-[9px]">
                        <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.08em] text-neutral-500">Leader prep</div>
                        <div className="text-[11.5px] leading-[1.55] text-neutral-400 text-pretty">{dd.leaderPrep}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-1 py-5 text-center text-[12px] leading-[1.5] text-neutral-500">No guides yet.{edit ? ' Add one for this week’s small group time.' : ''}</div>
      )}
      {playing ? <Player key={playing.id} group={playing} onClose={() => setPlaying(null)} /> : null}
    </>
  );
}

/* ── the player: one screen at a time, full bleed, made to be held up ──── */
function Player({ group, onClose }: { group: SmallGroup; onClose: () => void }) {
  const host = useOverlayHost();
  const [i, setI] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(group.screens.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [group, onClose]);
  if (!host) return null;
  const sc = group.screens[i];
  if (!sc) return null;
  const ty = typeOf(sc.type);
  const last = i === group.screens.length - 1;
  return createPortal(
    <div className="sr-dark absolute inset-0 z-[90] flex flex-col" style={{ background: ty.bg }} role="dialog" aria-label={group.title}>
      {sc.image?.layer === 'behind' ? (
        <div key={'bg-' + sc.id} className="pointer-events-none absolute inset-0 overflow-hidden">
          <PictureFill image={sc.image} fade iconSize={96} />
        </div>
      ) : null}
      <div className="relative flex items-center gap-[10px] px-[18px] pt-4">
        <button aria-label="Close" onClick={onClose} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-700 text-neutral-200" style={{ background: 'rgba(0,0,0,.25)' }}>
          <Icon name="ph ph-x" className="text-[14px]" />
        </button>
        <div className="min-w-0 flex-1 truncate text-[12px] font-medium leading-none text-neutral-300">{group.title}</div>
        <div className="text-[11px] font-medium leading-none text-neutral-400">
          {i + 1} / {group.screens.length}
        </div>
      </div>
      <div className="relative mx-[18px] mt-3 flex gap-1">
        {group.screens.map((_, k) => (
          <span key={k} className="h-[3px] flex-1 rounded-full" style={{ background: k <= i ? ty.color : 'rgba(255,255,255,.14)' }} />
        ))}
      </div>
      <div key={sc.id} className="relative flex flex-1 animate-[sr-rise_.25s_ease_both] flex-col items-center justify-center gap-[18px] overflow-auto px-[26px] py-6 text-center">
        <div className="flex items-center gap-2 rounded-full border px-[14px] py-[6px]" style={{ borderColor: ty.color, color: ty.color }}>
          <Icon name={ty.icon} className="text-[15px]" />
          <div className="text-[10.5px] font-semibold uppercase leading-none tracking-[.1em]">{ty.label}</div>
        </div>
        {sc.image?.layer === 'above' ? <PictureFrame image={sc.image} /> : null}
        <div className="max-w-[420px] text-[24px] font-medium leading-[1.3] text-neutral-100 text-pretty">{sc.title}</div>
        {sc.type === 'scripture' ? (
          <>
            <div className="max-w-[460px] text-[18px] italic leading-[1.55] text-neutral-200 text-pretty">“{sc.body}”</div>
            {sc.ref ? <div className="text-[13px] font-medium leading-none" style={{ color: ty.color }}>{sc.ref}</div> : null}
          </>
        ) : sc.body ? (
          <div className="max-w-[460px] text-[16px] leading-[1.5] text-neutral-300 text-pretty">{sc.body}</div>
        ) : null}
        <Interactive sc={sc} color={ty.color} />
        {sc.image?.layer === 'below' ? <PictureFrame image={sc.image} /> : null}
      </div>
      <div className="relative flex gap-[10px] px-[18px] pb-7">
        <Btn variant="ghost" className="min-h-12 flex-1 justify-center" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          Back
        </Btn>
        <Btn className="min-h-12 flex-[2] justify-center" onClick={() => (last ? onClose() : setI(i + 1))}>
          {last ? 'Finish' : 'Next'}
        </Btn>
      </div>
    </div>,
    host
  );
}

function Interactive({ sc, color }: { sc: SmallGroupScreen; color: string }) {
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [spin, setSpin] = useState<{ deg: number; pick: number | null }>({ deg: 0, pick: null });
  const [timer, setTimer] = useState<{ left: number; startedAt: number | null }>({ left: sc.timerSeconds ?? 120, startedAt: null });
  const now = useNow(timer.startedAt != null, 250);

  if (sc.type === 'poll' || sc.type === 'wyr') {
    const opts = sc.options?.length ? sc.options : sc.type === 'wyr' ? ['This one', 'That one'] : [];
    if (!opts.length) return null;
    const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="flex w-full max-w-[340px] flex-col gap-2">
        {opts.map((o, k) => {
          const pct = Math.round(((votes[k] ?? 0) / total) * 100);
          return (
            <button key={k} onClick={() => setVotes((v) => ({ ...v, [k]: (v[k] ?? 0) + 1 }))} className="relative flex min-h-12 items-center overflow-hidden rounded-md border px-[14px] text-left" style={{ borderColor: revealed ? color : 'var(--color-neutral-700)' }}>
              <div className="absolute inset-y-0 left-0 transition-[width] duration-300" style={{ width: revealed ? pct + '%' : 0, background: 'color-mix(in srgb, ' + color + ' 30%, transparent)' }} />
              <div className="relative flex-1 text-[13.5px] font-medium leading-[1.3] text-neutral-100">{o}</div>
              {revealed ? <div className="relative text-[12px] font-semibold leading-none text-neutral-200">{pct}%</div> : null}
            </button>
          );
        })}
        {!revealed ? (
          <>
            <Btn variant="secondary" className="mt-1 justify-center" onClick={() => setRevealed(true)}>
              <Icon name="ph ph-eye" className="mr-[6px] text-[14px]" />
              Reveal results
            </Btn>
            <div className="mt-[2px] text-[10.5px] leading-[1.4] text-neutral-500">Pass the phone — each tap is a vote, hidden until you reveal · {Object.values(votes).reduce((a, b) => a + b, 0)} so far</div>
          </>
        ) : (
          <div className="mt-[2px] text-[10.5px] leading-[1.4] text-neutral-500">{Object.values(votes).reduce((a, b) => a + b, 0)} votes from your circle</div>
        )}
      </div>
    );
  }
  /* A prayer list is ticked off the same way, one request at a time. */
  if ((sc.type === 'checklist' || sc.type === 'prayer') && sc.items?.length) {
    const done = sc.items.filter((_, k) => checked[k]).length;
    return (
      <div className="flex w-full max-w-[340px] flex-col gap-2">
        {sc.items.map((it, k) => (
          <button key={k} onClick={() => setChecked((c) => ({ ...c, [k]: !c[k] }))} aria-pressed={!!checked[k]} className="flex min-h-[46px] items-center gap-[10px] rounded-md border px-3 text-left" style={{ borderColor: checked[k] ? color : 'var(--color-neutral-700)', background: checked[k] ? 'color-mix(in srgb, ' + color + ' 14%, transparent)' : 'transparent' }}>
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border text-white" style={{ borderColor: checked[k] ? color : 'var(--color-neutral-600)', background: checked[k] ? color : 'transparent' }}>
              {checked[k] ? <Icon name="ph ph-check" className="text-[12px]" /> : null}
            </span>
            <div className="flex-1 text-[13px] font-medium leading-[1.3]" style={{ color: checked[k] ? 'var(--color-neutral-100)' : 'var(--color-neutral-300)' }}>
              {it}
            </div>
          </button>
        ))}
        <div className="mt-[2px] text-[11px] font-medium leading-none text-neutral-400">
          {done} of {sc.items.length} {sc.type === 'prayer' ? 'prayed for' : 'done'}
        </div>
      </div>
    );
  }
  if (sc.type === 'spinner') {
    const names = sc.items ?? [];
    if (!names.length) return <div className="text-[12px] leading-[1.4] text-neutral-500">Add names to this spinner in the small group editor.</div>;
    const seg = 360 / names.length;
    const wheel = 'conic-gradient(' + names.map((_, k) => SPIN[k % SPIN.length] + ' ' + k * seg + 'deg ' + (k + 1) * seg + 'deg').join(',') + ')';
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div className="relative h-[200px] w-[200px]">
          <div className="absolute -top-[6px] left-1/2 z-[2] h-0 w-0 -translate-x-1/2" style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '16px solid ' + color }} />
          <div className="h-full w-full rounded-full transition-transform duration-[2600ms] ease-[cubic-bezier(.17,.67,.2,1)]" style={{ background: wheel, transform: 'rotate(' + spin.deg + 'deg)' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-11 w-11 rounded-full bg-surface" style={{ boxShadow: 'var(--shadow-sm)' }} />
          </div>
        </div>
        <div className="flex max-w-[300px] flex-wrap justify-center gap-2">
          {names.map((n, k) => (
            <div key={k} className="flex items-center gap-[5px]">
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: SPIN[k % SPIN.length] }} />
              <span className="text-[11px] leading-none text-neutral-400">{n}</span>
            </div>
          ))}
        </div>
        <Btn
          className="min-h-12 px-[22px]"
          onClick={() => {
            const pick = crypto.getRandomValues(new Uint32Array(1))[0] % names.length;
            /* Land the picked slice under the pointer at the top. */
            const target = 360 - (pick * seg + seg / 2);
            setSpin((s) => ({ deg: s.deg - (s.deg % 360) + 360 * 5 + target, pick: null }));
            setTimeout(() => setSpin((s) => ({ ...s, pick })), 2650);
          }}
        >
          {spin.pick == null ? 'Spin' : 'Spin again'}
        </Btn>
        {spin.pick != null ? (
          <div className="flex items-center gap-2 text-[20px] font-semibold leading-[1.2]" style={{ color }}>
            <Icon name="ph-fill ph-confetti" className="text-[19px]" />
            {names[spin.pick]}
          </div>
        ) : null}
      </div>
    );
  }
  if (sc.type === 'timer') {
    const total = sc.timerSeconds ?? 120;
    const left = Math.max(0, timer.left - (timer.startedAt != null ? (now - timer.startedAt) / 1000 : 0));
    const pct = Math.round((1 - left / total) * 100);
    const label = Math.floor(left / 60) + ':' + String(Math.ceil(left % 60) === 60 ? 0 : Math.ceil(left % 60)).padStart(2, '0');
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full" style={{ background: 'conic-gradient(' + color + ' ' + pct + '%, var(--color-neutral-800) 0)' }}>
          <div className="tabular flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[#111] text-[34px] font-semibold leading-none text-neutral-100">{left <= 0 ? '0:00' : label}</div>
        </div>
        <div className="flex gap-[9px]">
          <Btn className="min-w-[110px] justify-center" onClick={() => setTimer((t) => (t.startedAt != null ? { left: Math.max(0, t.left - (Date.now() - t.startedAt) / 1000), startedAt: null } : { ...t, startedAt: Date.now() }))}>
            {timer.startedAt != null ? 'Pause' : left < total ? 'Resume' : 'Start'}
          </Btn>
          <Btn variant="ghost" onClick={() => setTimer({ left: total, startedAt: null })}>
            Reset
          </Btn>
        </div>
      </div>
    );
  }
  if (sc.type === 'video') {
    const embed = ytEmbedUrl(sc.videoUrl ?? '');
    if (!sc.videoUrl) return <div className="text-[12px] text-neutral-500">No video set for this screen.</div>;
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <div className="aspect-video w-full max-w-[400px] overflow-hidden rounded-md bg-black">
          {embed ? (
            <iframe src={embed} title={sc.title} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <video src={sc.videoUrl} controls playsInline className="h-full w-full object-contain" />
          )}
        </div>
        <a href={sc.videoUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium leading-none" style={{ color }}>
          Not loading? Open it directly ↗
        </a>
      </div>
    );
  }
  return null;
}

/* ── the editor: leaders build a guide screen by screen ────────────────── */
function GroupEditor({ group, onClose }: { group: SmallGroup; onClose: () => void }) {
  const d = useApp((s) => s.data);
  return (
    <Sheet open onClose={onClose} label="Small group editor" maxH="94%">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{d.smallGroups.some((x) => x.id === group.id) ? 'Edit small group' : 'New small group'}</div>
      <GroupForm group={group} onDone={onClose} />
    </Sheet>
  );
}

/** The guide's fields and screens, saved together: in a sheet on the
 *  phone, inline in the console. */
export function GroupForm({ group, onDone }: { group: SmallGroup; onDone: () => void }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const [g, setG] = useState<SmallGroup>(() => structuredClone(group));
  const patchScreen = (k: number, p: Partial<SmallGroupScreen>) => setG({ ...g, screens: g.screens.map((s, j) => (j === k ? { ...s, ...p } : s)) });
  const move = (k: number, dir: -1 | 1) => {
    const list = [...g.screens];
    const j = k + dir;
    if (j < 0 || j >= list.length) return;
    [list[k], list[j]] = [list[j], list[k]];
    setG({ ...g, screens: list });
  };
  const save = () => {
    if (!g.title.trim()) return api().say('Give the guide a title.');
    const exists = d.smallGroups.some((x) => x.id === g.id);
    saveGroups(api, (list) => (exists ? list.map((x) => (x.id === g.id ? g : x)) : [...list, g]));
    api().logActivity((exists ? 'Edited' : 'Added') + ' the small group “' + g.title + '” for Week ' + g.weekNumber);
    api().say('Saved. Coaches see it on Season › Small groups.');
    onDone();
  };
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const toggleTeam = (id: string) => {
    const on = new Set(g.teams?.length ? g.teams : []);
    if (on.has(id)) on.delete(id);
    else on.add(id);
    setG({ ...g, teams: on.size && on.size < d.teams.length ? d.teams.map((t) => t.id).filter((t) => on.has(t)) : null });
  };
  return (
    <>
      <label className="field">
        <span className="sr-label">Title</span>
        <input className="input" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="Week 10 · Who do you text at 2am?" />
      </label>
      <div className="flex gap-2">
        <label className="field flex-1">
          <span className="sr-label">Week</span>
          <select className="input" value={g.weekNumber} onChange={(e) => setG({ ...g, weekNumber: Number(e.target.value) })}>
            {Array.from({ length: d.config.seasonWeeks }, (_, k) => (
              <option key={k} value={k + 1}>
                Week {k + 1}
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1 self-end pb-3 text-[11px] leading-none text-neutral-500">about {sgMinutes(g.screens)} min</div>
      </div>
      <div className="flex flex-wrap items-center gap-[6px]" role="group" aria-label="Which squads it’s for">
        <button onClick={() => setG({ ...g, teams: null })} aria-pressed={!g.teams?.length} className={'min-h-11 rounded-full border px-3 text-[12px] font-medium leading-none ' + (!g.teams?.length ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
          All squads
        </button>
        {d.teams.map((t) => {
          const on = !!g.teams?.includes(t.id);
          return (
            <button key={t.id} onClick={() => toggleTeam(t.id)} aria-pressed={on} className="min-h-11 rounded-full border px-3 text-[12px] font-medium leading-none" style={{ borderColor: on ? t.color : 'var(--color-neutral-800)', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)', background: on ? 'color-mix(in srgb, ' + t.color + ' 16%, transparent)' : 'transparent' }}>
              {t.name}
            </button>
          );
        })}
      </div>
      <label className="field">
        <span className="sr-label">Notes for coaches</span>
        <textarea className="input !min-h-14" value={g.notes} onChange={(e) => setG({ ...g, notes: e.target.value })} placeholder="Split by grade, 20 min." />
      </label>
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Screens · {g.screens.length}</div>
      {g.screens.map((s, k) => {
        const ty = typeOf(s.type);
        return (
          <div key={s.id} className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-3" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
            <div className="flex items-center gap-2">
              <Icon name={ty.icon} className="text-[15px]" style={{ color: ty.color }} />
              <select className="input !min-h-11 flex-1 !py-0" value={s.type} onChange={(e) => patchScreen(k, { type: e.target.value })} aria-label="Screen type">
                {SG_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button aria-label="Move up" onClick={() => move(k, -1)} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400">
                <Icon name="ph ph-arrow-up" className="text-[13px]" />
              </button>
              <button aria-label="Move down" onClick={() => move(k, 1)} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400">
                <Icon name="ph ph-arrow-down" className="text-[13px]" />
              </button>
              <button aria-label="Delete screen" onClick={() => setG({ ...g, screens: g.screens.filter((_, j) => j !== k) })} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500">
                <Icon name="ph ph-trash" className="text-[13px]" />
              </button>
            </div>
            <input className="input" value={s.title} onChange={(e) => patchScreen(k, { title: e.target.value })} placeholder="Headline" aria-label="Headline" />
            <textarea className="input !min-h-14" value={s.body} onChange={(e) => patchScreen(k, { body: e.target.value })} placeholder={s.type === 'scripture' ? 'The verse text' : 'What to say or ask'} aria-label="Body" />
            {s.type === 'scripture' ? <input className="input" value={s.ref ?? ''} onChange={(e) => patchScreen(k, { ref: e.target.value })} placeholder="Ephesians 2:10" aria-label="Reference" /> : null}
            {s.type === 'poll' || s.type === 'wyr' ? <textarea className="input !min-h-14" value={(s.options ?? []).join('\n')} onChange={(e) => patchScreen(k, { options: lines(e.target.value) })} placeholder="One option per line" aria-label="Options" /> : null}
            {s.type === 'checklist' || s.type === 'spinner' || s.type === 'prayer' ? (
              <textarea className="input !min-h-14" value={(s.items ?? []).join('\n')} onChange={(e) => patchScreen(k, { items: lines(e.target.value) })} placeholder={s.type === 'spinner' ? 'One name per line' : s.type === 'prayer' ? 'One request per line' : 'One step per line'} aria-label="Items" />
            ) : null}
            {s.type === 'video' ? <input className="input" value={s.videoUrl ?? ''} onChange={(e) => patchScreen(k, { videoUrl: e.target.value })} placeholder="YouTube link" aria-label="Video link" /> : null}
            {s.type === 'timer' ? (
              <input className="input" type="number" min={10} step={10} value={s.timerSeconds ?? 120} onChange={(e) => patchScreen(k, { timerSeconds: Math.max(10, Number(e.target.value) || 120) })} aria-label="Seconds" />
            ) : null}
            <PictureEditor image={s.image} onChange={(img) => patchScreen(k, { image: img })} />
          </div>
        );
      })}
      <AddScreen onAdd={(sc) => setG({ ...g, screens: [...g.screens, sc] })} />
      <div className="flex gap-2">
        <Btn variant="ghost" className="min-h-12 flex-1 justify-center" onClick={onDone}>
          Cancel
        </Btn>
        <Btn className="min-h-12 flex-[2] justify-center" onClick={save}>
          Save guide
        </Btn>
      </div>
    </>
  );
}

/* Add a screen by what kind it is, then start from an idea or blank. */
function AddScreen({ onAdd }: { onAdd: (sc: SmallGroupScreen) => void }) {
  const [type, setType] = useState<string | null>(null);
  const ty = type ? typeOf(type) : null;
  const add = (sc: SmallGroupScreen) => {
    onAdd(sc);
    setType(null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Add a screen</div>
      <div className="flex flex-wrap gap-[6px]" role="group" aria-label="Add a screen">
        {SG_TYPES.map((t) => (
          <button
            key={t.id}
            aria-pressed={type === t.id}
            onClick={() => setType(type === t.id ? null : t.id)}
            className="flex min-h-11 items-center gap-[6px] rounded-full border px-3 text-[12px] font-medium leading-none"
            style={{ borderColor: type === t.id ? t.color : 'var(--color-neutral-800)', color: type === t.id ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)', background: type === t.id ? 'color-mix(in srgb, ' + t.color + ' 16%, transparent)' : 'transparent' }}
          >
            <Icon name={t.icon} className="text-[14px]" style={{ color: t.color }} />+ {t.label}
          </button>
        ))}
      </div>
      {ty ? (
        <div className="flex flex-col gap-[6px] rounded-lg border border-neutral-800 p-[10px]" role="region" aria-label={ty.label + ' ideas'}>
          <div className="flex items-center gap-2">
            <Icon name={ty.icon} className="text-[15px]" style={{ color: ty.color }} />
            <div className="flex-1 text-[13px] font-medium text-neutral-100">{ty.label} · start from an idea</div>
            <button aria-label="Close ideas" onClick={() => setType(null)} className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-400">
              <Icon name="ph ph-x" className="text-[13px]" />
            </button>
          </div>
          {ideasFor(ty.id).map((idea, n) => (
            <button key={n} onClick={() => add(screenFrom(ty.id, uid(), idea))} className="flex min-h-11 flex-col items-start gap-[3px] rounded-md border border-neutral-800 px-3 py-[9px] text-left sr-hover">
              <span className="text-[12.5px] font-medium leading-[1.3] text-neutral-100">{idea.title}</span>
              {idea.body || idea.options || idea.items ? (
                <span className="text-[11.5px] leading-[1.4] text-neutral-500">{idea.body || (idea.options ?? idea.items ?? []).join(' · ')}</span>
              ) : null}
            </button>
          ))}
          <Btn variant="ghost" className="justify-center" onClick={() => add(screenFrom(ty.id, uid()))}>
            Start blank
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

/* ── BADGES & STREAKS ─────────────────────────────────────────────────── */
export function BadgesScreen() {
  const d = useApp((s) => s.data);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = useMemo(() => computeBadges(d).filter((b) => !needle || b.name.toLowerCase().includes(needle) || teamOf(d, b.teamId).name.toLowerCase().includes(needle)), [d, needle]);
  return (
    <Screen label="Badges">
      <ScreenHeader title="Badges & Streaks" back="/dashboard/more" />
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">A badge needs both an attendance streak and a Bible practice streak running together — showing up is only half of it.</div>
      <div className="relative">
        <Icon name="ph ph-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or squad" aria-label="Search badges" className="input w-full !pl-[34px]" />
        {q ? (
          <button aria-label="Clear search" onClick={() => setQ('')} className="absolute right-[6px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400">
            <Icon name="ph ph-x" className="text-[13px]" />
          </button>
        ) : null}
      </div>
      {!list.length ? <div className="rounded-lg bg-surface px-4 py-[22px] text-center text-[12.5px] leading-[1.5] text-neutral-500">{needle ? 'No one matches that search.' : 'No streaks yet — they start with the first check-in and the first practice.'}</div> : null}
      <div className="flex flex-col gap-2">
        {list.map((b) => {
          const t = teamOf(d, b.teamId);
          const color = b.tier ? TIER_COLOR[b.tier] : 'var(--color-neutral-500)';
          return (
            <div key={b.name} className="sr-card flex items-center gap-[11px] px-[14px] py-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[13px] font-semibold leading-none text-neutral-100" style={{ background: tint(t.color) }}>
                {initialsOf(b.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-[1.2] text-neutral-200">
                  {b.name} <span className="font-normal text-neutral-500">· {t.name}</span>
                </div>
                <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500">
                  {b.attendStreak} wk attendance · {b.bibleStreak}-day Bible
                </div>
              </div>
              <div className="flex flex-none items-center gap-[5px]">
                <Icon name={b.tier ? 'ph-fill ph-medal' : 'ph ph-medal'} className="text-[15px]" style={{ color }} />
                <span className="text-[11px] font-medium leading-none" style={{ color }}>
                  {b.tier ?? 'Building'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

