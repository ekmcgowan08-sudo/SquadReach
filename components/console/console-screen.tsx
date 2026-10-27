'use client';
/* CONSOLE — the desktop shape of the ministry. Every save goes through the
   same store and sync events as the phone, so a change here lands on every
   phone the same way. */
import { FILM_DEFAULTS } from '@/lib/types/model';
import { DEFAULT_ZONE, ZONES } from '@/lib/time-zone';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ChallengesTab } from '@/components/console/challenges-tab';
import { HuddleTab } from '@/components/console/huddle-tab';
import { Field, Section, useSaveConfig } from '@/components/console/kit';
import { CycleSection } from '@/components/console/cycle-section';
import { PeopleTab } from '@/components/console/people-tab';
import { ReportsTab } from '@/components/console/reports-tab';
import { ScoringTab } from '@/components/console/scoring-tab';
import { SeasonTab } from '@/components/console/season-tab';
import { WalkthroughChapters } from '@/components/walkthrough-chapters';
import { Btn, Icon, Switch2 } from '@/components/ui';
import { isoDay, parseLocalISO } from '@/lib/dates';
import { pointBase, fmt } from '@/lib/scoring';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Team } from '@/lib/types/model';

const TABS = [
  { id: 'setup', label: 'Setup', icon: 'ph ph-sliders-horizontal' },
  { id: 'season', label: 'Season builder', icon: 'ph ph-map-trifold' },
  { id: 'teams', label: 'Squads', icon: 'ph ph-shield-check' },
  { id: 'scoring', label: 'Scoring', icon: 'ph ph-trophy' },
  { id: 'challenges', label: 'Challenges', icon: 'ph ph-flag-checkered' },
  { id: 'people', label: 'People', icon: 'ph ph-users-three' },
  { id: 'huddle', label: 'Huddle sheet', icon: 'ph ph-clipboard-text' },
  { id: 'reports', label: 'Reports', icon: 'ph ph-file-arrow-down' },
  { id: 'walkthrough', label: 'Walkthrough', icon: 'ph ph-compass' }
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ConsoleScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'setup') as TabId;
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 pb-16 pt-5 md:flex-row">
      <nav className="flex flex-none gap-[6px] overflow-x-auto md:w-[200px] md:flex-col" aria-label="Console sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => router.replace('/console?tab=' + t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className="flex min-h-11 flex-none items-center gap-2 rounded-md px-3 text-left text-[13px] font-medium leading-none"
            style={{ background: tab === t.id ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: tab === t.id ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            <Icon name={t.icon} className="text-[15px]" />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        {tab === 'setup' ? <SetupTab /> : tab === 'season' ? <SeasonTab /> : tab === 'teams' ? <TeamsTab /> : tab === 'scoring' ? <ScoringTab /> : tab === 'challenges' ? <ChallengesTab /> : tab === 'people' ? <PeopleTab /> : tab === 'huddle' ? <HuddleTab /> : tab === 'walkthrough' ? <WalkthroughTab /> : <ReportsTab />}
      </div>
    </div>
  );
}

/* ── SETUP ─────────────────────────────────────────────────────────────── */
function SetupTab() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const save = useSaveConfig();
  const c = d.config;
  const film = c.filmUpload ?? FILM_DEFAULTS;
  const [start, setStart] = useState(c.meetingDates[0] ?? isoDay(new Date()));
  const [count, setCount] = useState(c.seasonWeeks || 9);
  const [newDate, setNewDate] = useState('');

  const layDates = () => {
    const first = parseLocalISO(start);
    if (!first) return api().say('Pick the first night.');
    const dates = Array.from({ length: Math.max(1, Math.min(52, count)) }, (_, i) => {
      const x = new Date(first);
      x.setDate(x.getDate() + i * 7);
      return isoDay(x);
    });
    save({ meetingDates: dates, seasonWeeks: dates.length }, 'Set ' + dates.length + ' meeting nights starting ' + start);
    api().say(dates.length + ' weekly nights on the calendar.');
  };
  const rotate = async () => {
    if (!window.confirm('Retire the current invite code? Anyone holding the old one can’t use it to ask in anymore.')) return;
    if (api().backend.mode === 'demo') {
      const code = 'NSY-' + Math.random().toString(36).slice(2, 4).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
      save({ inviteCode: code }, 'Rotated the invite code');
    } else {
      await api().backend.sync({ kind: 'rotateInvite' }).catch(() => undefined);
      const fresh = await api().backend.load();
      api().mutate((x) => void (x.config.inviteCode = fresh.config.inviteCode));
      api().logActivity('Rotated the invite code');
    }
    api().say('New invite code is live.');
  };

  return (
    <>
      <Section title="Ministry" sub="The name families and students see everywhere.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ministry name" value={c.ministryName} onSave={(v) => v.trim() && save({ ministryName: v.trim() }, 'Renamed the ministry to ' + v.trim())} />
          <Field label="This season’s game" value={c.gameName} placeholder="Pipeline relay" onSave={(v) => save({ gameName: v.trim() })} />
          <Field label="Home venue" value={c.venueAddress} placeholder="Church name · street address" onSave={(v) => save({ venueAddress: v.trim() })} />
          <label className="field">
            <span className="sr-label">Time zone</span>
            <select className="input" value={c.timeZone ?? DEFAULT_ZONE} onChange={(e) => save({ timeZone: e.target.value }, 'Time zone is now ' + e.target.value)}>
              {[...new Set([c.timeZone ?? DEFAULT_ZONE, ...ZONES])].map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-neutral-500">Scheduled report emails go out by this clock.</span>
          </label>
        </div>
      </Section>

      <Section title="Game film" sub="Clips are filmed on a phone and stay there unless someone adds one to the week album. Turn this on to allow that. Uploaded film takes storage space, so it has a size limit and leaves the album after a set time; the copy on the phone that filmed it isn’t touched.">
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <div className="field">
            <span className="sr-label" aria-hidden="true">Clips in the album</span>
            <Switch2 label="Clips in the album" value={film.on ? 'on' : 'off'} options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'Allowed' }]} onChange={(v) => save({ filmUpload: { ...film, on: v === 'on' } }, v === 'on' ? 'Allowed game film in the album' : 'Stopped new game film in the album')} />
          </div>
          <Field label="Largest clip (MB)" type="number" value={film.maxMb} onSave={(v) => save({ filmUpload: { ...film, maxMb: Math.max(5, Math.min(500, Number(v) || FILM_DEFAULTS.maxMb)) } })} />
          <Field label="Keep for (days)" type="number" value={film.keepDays} onSave={(v) => save({ filmUpload: { ...film, keepDays: Math.max(1, Math.min(365, Number(v) || FILM_DEFAULTS.keepDays)) } })} hint="Then it leaves the album for good." />
        </div>
      </Section>

      <Section title="Meeting nights" sub={'Week numbers come from these dates. Tonight is week ' + c.weekNumber + ' of ' + c.seasonWeeks + '.'}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field">
            <span className="sr-label">First night</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field w-28">
            <span className="sr-label">Weeks</span>
            <input className="input" type="number" min={1} max={52} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
          </label>
          <Btn className="px-4" onClick={layDates}>
            Lay out weekly nights
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.meetingDates.map((iso, i) => (
            <span key={iso} className="flex min-h-9 items-center gap-2 rounded-full border border-neutral-800 pl-3 pr-1 text-[12px] text-neutral-300">
              W{i + 1} · {parseLocalISO(iso)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              <button aria-label={'Remove ' + iso} onClick={() => save((cc) => ({ meetingDates: cc.meetingDates.filter((x) => x !== iso), seasonWeeks: Math.max(1, cc.meetingDates.length - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500">
                <Icon name="ph ph-x" className="text-[11px]" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="field">
            <span className="sr-label">Add one night (a make-up, a retreat)</span>
            <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <Btn
            variant="secondary"
            className="px-4"
            onClick={() => {
              if (!newDate || c.meetingDates.includes(newDate)) return;
              save((cc) => {
                const dates = [...cc.meetingDates, newDate].sort();
                return { meetingDates: dates, seasonWeeks: dates.length };
              });
              setNewDate('');
            }}
          >
            Add
          </Btn>
        </div>
      </Section>

      <Section title="Point values" sub={'Tonight’s base is ' + fmt(pointBase(c)) + ' — it grows each week so late weeks still matter.'}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Week 1 point base" type="number" value={c.pointBase} onSave={(v) => save({ pointBase: Math.max(1, Number(v) || c.pointBase) })} />
          <Field label="Weekly growth %" type="number" value={c.weekGrowthPct} onSave={(v) => save({ weekGrowthPct: Math.max(0, Number(v) || 0) })} />
          <Field label="Points per goal (filming)" type="number" value={c.goalValue} onSave={(v) => save({ goalValue: Math.max(1, Number(v) || c.goalValue) })} />
          <Field label="Points per verse recited" type="number" value={c.versePts} onSave={(v) => save({ versePts: Math.max(0, Number(v) || 0) })} />
          <Field label="Verse board bonus" type="number" value={c.verseBoard} onSave={(v) => save({ verseBoard: Math.max(0, Number(v) || 0) })} />
        </div>
      </Section>

      <CycleSection />

      <Section title="Memory verses" sub="One per week. KJV text fills the drills; add ASV or RVR1909 if you use them.">
        <div className="flex flex-col gap-2">
          {Array.from({ length: c.seasonWeeks }, (_, i) => i + 1).map((w) => {
            const v = c.memoryVerses.find((x) => x.week === w);
            const set = (patch: { ref?: string; kjv?: string }) =>
              save((cc) => {
                const list = cc.memoryVerses.filter((x) => x.week !== w);
                const cur = cc.memoryVerses.find((x) => x.week === w) ?? { week: w, ref: '', text: {} };
                const next = { ...cur, ref: patch.ref ?? cur.ref, text: { ...cur.text, ...(patch.kjv != null ? { KJV: patch.kjv } : {}) } };
                return { memoryVerses: next.ref || next.text.KJV ? [...list, next].sort((a, b) => a.week - b.week) : list };
              });
            return (
              <div key={w} className="grid items-start gap-2 sm:grid-cols-[64px_180px_1fr]">
                <div className="pt-3 text-[12px] font-medium text-neutral-400">Week {w}</div>
                <Field label="Reference" value={v?.ref ?? ''} placeholder="Joshua 1:9" onSave={(x) => set({ ref: x.trim() })} />
                <Field label="Text (KJV)" value={v?.text.KJV ?? ''} placeholder="Have not I commanded thee?…" onSave={(x) => set({ kjv: x.trim() })} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Church card" sub="Shows at the bottom of Home so families can find you.">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['address', 'Address'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['web', 'Website'],
              ['studentsPage', 'Students page'],
              ['instagram', 'Instagram'],
              ['youtube', 'YouTube'],
              ['facebook', 'Facebook'],
              ['tiktok', 'TikTok']
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} value={c.church[k]} onSave={(v) => save((cc) => ({ church: { ...cc.church, [k]: v.trim() } }))} />
          ))}
        </div>
      </Section>

      <Section
        title="Invite code"
        sub="Anyone with it can ask to join; a leader approves each request on Access requests."
        right={
          <Btn variant="secondary" className="px-3" onClick={() => void rotate()}>
            Rotate
          </Btn>
        }
      >
        <div className="flex items-center gap-3">
          <code className="rounded-md bg-neutral-900 px-3 py-2 text-[16px] font-semibold tracking-[.08em] text-neutral-100">{c.inviteCode || '—'}</code>
          <span className="text-[12px] text-neutral-500">Invite link: {typeof window !== 'undefined' ? window.location.origin : ''}/join/{c.inviteCode}</span>
        </div>
        {m.mode === 'demo' ? <div className="text-[11.5px] text-neutral-500">Demo: changes here live on this browser only.</div> : null}
      </Section>
    </>
  );
}

/* ── SQUADS ────────────────────────────────────────────────────────────── */
const SWATCHES = ['#EAB308', '#DC2626', '#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#0D9488', '#DB2777'];

function TeamsTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const saveTeam = (t: Team, note?: string) => {
    api().mutate((x) => {
      const i = x.teams.findIndex((y) => y.id === t.id);
      if (i >= 0) x.teams[i] = t;
      else x.teams.push(t);
    });
    api().emit({ kind: 'team', team: t });
    if (note) api().logActivity(note);
  };
  return (
    <Section
      title="Squads"
      sub="Names, colours and mascots. Removing a squad archives it — its points stay in the ledger."
      right={
        <Btn
          className="px-3"
          onClick={() => {
            const n = d.teams.length;
            saveTeam({ id: uid(), name: 'Squad ' + (n + 1), color: SWATCHES[n % SWATCHES.length], mascotName: '', mascotStory: '', sort: n }, 'Added a squad');
          }}
        >
          + Squad
        </Btn>
      }
    >
      <div className="flex flex-col gap-3">
        {d.teams.map((t) => (
          <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <Field label="Name" value={t.name} onSave={(v) => v.trim() && saveTeam({ ...t, name: v.trim() }, 'Renamed a squad to ' + v.trim())} />
              </div>
              <div className="flex flex-wrap gap-[6px] pb-1">
                {SWATCHES.map((c) => (
                  <button key={c} aria-label={'Colour ' + c} aria-pressed={t.color === c} onClick={() => saveTeam({ ...t, color: c })} className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: t.color === c ? '0 0 0 2px var(--color-bg), 0 0 0 4px ' + c : undefined }} />
                ))}
              </div>
              <span className="flex-1" />
              <span className="pb-3 text-[12px] text-neutral-500">{d.roster.filter((r) => r.team === t.id).length} students</span>
              <Btn
                variant="ghost"
                className="px-3"
                onClick={() => {
                  if (!window.confirm('Remove ' + t.name + '? Its points stay in the ledger and its students become unassigned.')) return;
                  api().mutate((x) => {
                    x.teams = x.teams.filter((y) => y.id !== t.id);
                    for (const r of x.roster) if (r.team === t.id) r.team = null;
                  });
                  api().emit({ kind: 'teamRemove', id: t.id });
                  api().logActivity('Removed the squad ' + t.name);
                }}
              >
                Remove
              </Btn>
            </div>
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <Field label="Mascot" value={t.mascotName} placeholder="The Hornets" onSave={(v) => saveTeam({ ...t, mascotName: v.trim() })} />
              <Field label="Mascot story" value={t.mascotStory} placeholder="Why this squad is the Hornets…" onSave={(v) => saveTeam({ ...t, mascotStory: v.trim() })} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function WalkthroughTab() {
  return (
    <Section title="Walkthrough" sub="Written for your first month, in the order a week actually happens. Every chapter ends somewhere real, so reading it and doing it are one trip.">
      <WalkthroughChapters />
    </Section>
  );
}
