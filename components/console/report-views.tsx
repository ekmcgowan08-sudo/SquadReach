'use client';
/* CONSOLE · REPORTS · AT A GLANCE — the season as it stands, read from the
   same data as every report: rosters, player stats, attendance and squad
   trends by week, Bible practice, visitors, the verse board, badges,
   events, what's waiting and the activity log. Each view can be turned
   off for this person. */
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { WeekBars } from '@/components/charts/week-bars';
import { Section } from '@/components/console/kit';
import { PastSeasonsTable } from '@/components/console/past-seasons';
import { Icon, cx } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { playerStats } from '@/lib/goals';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { sourceRows } from '@/lib/report-builder';
import { attendanceByWeek, bibleByWeek, squadTrends } from '@/lib/report-views';
import { fmt, teamTotal } from '@/lib/scoring';
import { catOf, computeBadges, eventLabel, teamOf } from '@/lib/selectors';
import { useApp } from '@/lib/store/provider';

const VIEWS = [
  { id: 'past', label: 'Past seasons', icon: 'ph ph-clock-counter-clockwise' },
  { id: 'rosters', label: 'Squad rosters', icon: 'ph ph-users-three' },
  { id: 'players', label: 'Player stats', icon: 'ph ph-soccer-ball' },
  { id: 'attendance', label: 'Attendance', icon: 'ph ph-chart-bar' },
  { id: 'trends', label: 'Squad trends', icon: 'ph ph-trend-up' },
  { id: 'bible', label: 'Bible practice', icon: 'ph ph-book-open-text' },
  { id: 'visitors', label: 'Visitor follow-up', icon: 'ph ph-hand-waving' },
  { id: 'verses', label: 'Verse board', icon: 'ph ph-scroll' },
  { id: 'badges', label: 'Growth badges', icon: 'ph ph-medal' },
  { id: 'events', label: 'Events', icon: 'ph ph-calendar-dots' },
  { id: 'approvals', label: 'Waiting for approval', icon: 'ph ph-seal-check' },
  { id: 'activity', label: 'Activity log', icon: 'ph ph-list-bullets' }
] as const;

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-[12.5px] text-neutral-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[.1em] text-neutral-500">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-divider">
              {r.map((c, j) => (
                <td key={j} className={cx('py-2 pr-4', j ? 'text-neutral-300' : 'text-neutral-100')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportViews() {
  const d = useApp((s) => s.data);
  const off = usePrefs().reportViewsOff;
  const [q, setQ] = useState('');
  const today = isoDay(new Date());
  const on = (id: string) => !off[id];
  const team = (id: string | null | undefined) => teamOf(d, id);
  const dot = (id: string | null | undefined) => <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: team(id).color }} />;

  const attendance = attendanceByWeek(d, today);
  const bible = bibleByWeek(d, today);
  const trends = squadTrends(d, today);
  const badges = computeBadges(d);
  const players = playerStats(d.ledger, (n) => d.roster.find((r) => r.name === n)?.team ?? '');
  const pending = d.ledger.filter((e) => e.status === 'pending').sort((a, b) => b.at - a.at);
  const needle = q.trim().toLowerCase();
  const activity = d.activityLog.filter((a) => !needle || a.line.toLowerCase().includes(needle)).slice(0, 40);

  return (
    <>
      <Section title="Customize this view" sub="The season at a glance, below. Turn off what you don’t need; it stays that way on this computer.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Views shown">
          {VIEWS.map((v) => (
            <button key={v.id} aria-pressed={on(v.id)} onClick={() => setPrefs((p) => ({ reportViewsOff: { ...p.reportViewsOff, [v.id]: on(v.id) } }))} className={cx('flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12.5px]', on(v.id) ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-500')}>
              <Icon name={v.icon} className="text-[14px]" />
              {v.label}
            </button>
          ))}
        </div>
      </Section>

      {on('past') ? (
        <Section title="Past seasons" sub="Champions and top scorers, season by season.">
          <PastSeasonsTable />
        </Section>
      ) : null}

      {on('rosters') ? (
        <Section title="Squad rosters" sub="Who is on each squad after the draft and any trades since.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.teams.map((t) => {
              const kids = d.roster.filter((r) => r.team === t.id).sort((a, b) => a.name.localeCompare(b.name));
              return (
                <div key={t.id} className="rounded-md px-3 py-2" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
                  <div className="mb-1 flex items-center text-[13px] font-medium text-neutral-100">
                    {dot(t.id)}
                    {t.name} <span className="ml-auto text-[11.5px] font-normal text-neutral-500">{kids.length}</span>
                  </div>
                  {kids.length ? (
                    <ul tabIndex={0} aria-label={t.name + ' roster'} className="max-h-[260px] overflow-y-auto text-[12px] text-neutral-300 outline-none focus-visible:ring-2 focus-visible:ring-accent-400">
                      {kids.map((k) => (
                        <li key={k.id} className="py-[2px]">
                          {k.name} <span className="text-neutral-500">· Grade {k.grade || '—'}</span>
                          {k.captain ? <span className="text-accent-300"> · C</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-neutral-500">No one drafted yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {on('players') ? (
        <Section title="Player stats" sub="Goals, assists and MVPs from games with goal scoring on.">
          <Table head={['Player', 'Squad', 'Goals', 'Assists', 'MVPs']} rows={players.slice(0, 15).map((p) => [p.name, <span key="s">{dot(p.team)}{team(p.team).name}</span>, p.goals, p.assists, p.mvp])} empty="No goals logged yet. Turn on goal scoring for a game in Live control or on the game timer." />
        </Section>
      ) : null}

      {on('attendance') ? (
        <Section title="Attendance over the season" sub="Share of the roster here each night, every squad together.">
          <WeekBars weeks={attendance} label="Attendance by week" format={(v) => v + '%'} />
        </Section>
      ) : null}

      {on('trends') ? (
        <Section title="Squad trends" sub="Each squad’s running total at the end of each week.">
          <div className="grid gap-4 sm:grid-cols-2">
            {trends.map((s) => (
              <div key={s.team}>
                <div className="mb-1 flex items-center text-[13px] text-neutral-100">
                  {dot(s.team)}
                  {team(s.team).name}
                  <span className="tabular ml-auto text-neutral-300">{fmt(teamTotal(d.ledger, s.team))}</span>
                </div>
                <WeekBars weeks={s.weeks} label={team(s.team).name + ' running total by week'} format={fmt} color={team(s.team).color} height={64} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {on('bible') ? (
        <Section title="Bible practice" sub="How many people read at least once each week, and the longest streaks running. Practice is never scored.">
          <WeekBars weeks={bible} label="People who practiced, by week" format={(v) => v + (v === 1 ? ' person' : ' people')} />
          <Table
            head={['Student', 'Squad', 'Attendance streak', 'Bible streak']}
            rows={[...badges].sort((a, b) => b.bibleStreak - a.bibleStreak).slice(0, 8).map((b) => [b.name, <span key="s">{dot(b.teamId)}{team(b.teamId).name}</span>, b.attendStreak + (b.attendStreak === 1 ? ' wk' : ' wks'), b.bibleStreak + (b.bibleStreak === 1 ? ' day' : ' days')])}
            empty="No streaks yet."
          />
        </Section>
      ) : null}

      {on('visitors') ? (
        <Section title="Visitor follow-up" sub="Every friend brought, by name, with who brought them — the list the visitor follow-up delivery carries.">
          <Table head={['Friend', 'Brought by', 'Squad', 'Week', 'New?']} rows={sourceRows(d, 'visitors').slice(-12).reverse().map((r) => [String(r.friend || '—'), String(r.broughtBy), String(r.squad), String(r.week), r.kind === 'new' ? 'New to the ministry' : 'Already known'])} empty="No friends logged yet." />
        </Section>
      ) : null}

      {on('verses') ? (
        <Section title="Verse board" sub="Verses each student has recited, and what it paid.">
          <Table head={['Student', 'Squad', 'Verses', 'Points', 'Nights']} rows={sourceRows(d, 'verses').sort((a, b) => Number(b.verses) - Number(a.verses)).slice(0, 12).map((r) => [String(r.student), String(r.squad), String(r.verses), fmt(Number(r.points)), String(r.nights)])} empty="No verses recited yet." />
        </Section>
      ) : null}

      {on('badges') ? (
        <Section title="Growth badges" sub="A badge needs an attendance streak and a Bible streak running together.">
          <Table head={['Student', 'Squad', 'Badge']} rows={badges.filter((b) => b.tier).map((b) => [b.name, <span key="s">{dot(b.teamId)}{team(b.teamId).name}</span>, b.tier])} empty="No badges earned yet." />
        </Section>
      ) : null}

      {on('events') ? (
        <Section title="Events & proposals">
          <Table head={['Event', 'Date', 'Status']} rows={[...d.events].sort((a, b) => (a.iso ?? '9').localeCompare(b.iso ?? '9')).map((e) => [e.title, eventLabel(e), e.status === 'proposed' ? 'Waiting for approval' : e.iso && e.iso < today ? 'Done' : 'Live'])} empty="Nothing on the calendar." />
        </Section>
      ) : null}

      {on('approvals') ? (
        <Section title="Waiting for approval" sub="Read only here — approve or send back from Approvals.">
          {pending.length ? (
            <div className="flex flex-col">
              {pending.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center gap-2 border-t border-divider py-2 text-[12.5px] first:border-t-0">
                  {dot(e.team)}
                  <span className="tabular text-neutral-100">{(e.amount > 0 ? '+' : '') + fmt(e.amount)}</span>
                  <span className="text-neutral-300">
                    {catOf(d, e.cat).label} → {team(e.team).name} by {e.by}
                  </span>
                  <span className="truncate text-neutral-500">· {e.why}</span>
                </div>
              ))}
              <Link href="/dashboard/approvals" className="mt-2 text-[12.5px] text-accent-300 underline underline-offset-2">
                Open Approvals
              </Link>
            </div>
          ) : (
            <p className="text-[12.5px] text-neutral-500">Nothing waiting.</p>
          )}
        </Section>
      ) : null}

      {on('activity') ? (
        <Section title="Activity log" sub="Every decision and change, newest first.">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search the log…" aria-label="Search the activity log" />
          {activity.length ? (
            <div className="flex flex-col">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3 border-t border-divider py-[6px] text-[12.5px] first:border-t-0">
                  <span className="w-[120px] flex-none text-neutral-500">{new Date(a.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-neutral-200">{a.line}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-neutral-500">{needle ? 'Nothing matches.' : 'Nothing logged yet.'}</p>
          )}
        </Section>
      ) : null}
    </>
  );
}
