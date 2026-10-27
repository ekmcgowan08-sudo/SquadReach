'use client';
/* The console's "Search students by name…": type a few letters, pick a
   student, and their card opens — squad, grade, points and rank, their
   streaks, tonight, the last points they earned and their family. */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Icon, cx, initialsOf, tint } from '@/components/ui';
import { fmt, studentRanks } from '@/lib/scoring';
import { TIER_COLOR, catOf, computeBadges, teamOf } from '@/lib/selectors';
import { useApp } from '@/lib/store/provider';

function StudentCard({ name }: { name: string }) {
  const d = useApp((s) => s.data);
  const s = d.roster.find((r) => r.name === name);
  if (!s) return null;
  const t = teamOf(d, s.team);
  const rank = studentRanks(d.roster, d.ledger, d.studentSeedPoints).find((r) => r.name === name);
  const badge = computeBadges(d).find((b) => b.name === name);
  const here = !!d.tonight.presence[name];
  const recent = d.ledger.filter((e) => e.student === name).sort((a, b) => b.at - a.at).slice(0, 6);
  const fam = d.families[name];
  const stats = [
    { label: 'Points this season', value: fmt(rank?.total ?? 0), hint: rank ? '#' + rank.rank + ' of ' + d.roster.length : '' },
    { label: 'Attendance streak', value: (badge?.attendStreak ?? 0) + ' wks', hint: badge?.tier ? badge.tier + ' badge' : 'no badge yet' },
    { label: 'Bible streak', value: (badge?.bibleStreak ?? 0) + ' days', hint: here ? 'here tonight' : 'not checked in tonight' }
  ];
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-[15px] font-semibold text-neutral-100" style={{ background: tint(t.color) }}>
          {initialsOf(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {s.team ? t.name : 'No squad yet'}
            </span>
            {s.grade ? <span>· Grade {s.grade}</span> : null}
            {s.captain ? <span className="text-accent-300">· Captain</span> : null}
            {s.guest ? <span>· Guest</span> : null}
            {badge?.tier ? <span style={{ color: TIER_COLOR[badge.tier] }}>· {badge.tier}</span> : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((x) => (
          <div key={x.label} className="rounded-md bg-neutral-900 px-3 py-2" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
            <div className="text-[10px] font-semibold uppercase leading-[1.3] tracking-[.1em] text-neutral-500">{x.label}</div>
            <div className="tabular mt-1 text-[17px] font-medium text-neutral-100">{x.value}</div>
            <div className="text-[11px] text-neutral-500">{x.hint}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">Recent points</div>
        {recent.length ? (
          recent.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-t border-divider py-2 text-[12.5px] first:border-t-0">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: catOf(d, e.cat).color }} />
              <span className="min-w-0 flex-1 truncate text-neutral-200">{e.why || catOf(d, e.cat).label}</span>
              <span className="text-neutral-500">{new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className={cx('tabular w-16 text-right', e.status === 'approved' ? 'text-neutral-100' : 'text-neutral-500')}>
                {(e.amount > 0 ? '+' : '') + fmt(e.amount)}
                {e.status === 'pending' ? '*' : ''}
              </span>
            </div>
          ))
        ) : (
          <div className="text-[12px] text-neutral-500">No points with their name on them yet.</div>
        )}
        {recent.some((e) => e.status === 'pending') ? <div className="mt-1 text-[11px] text-neutral-500">* waiting on approval</div> : null}
      </div>
      <div className="rounded-md px-3 py-2 text-[12.5px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">Family</div>
        {fam ? (
          <div className="mt-1 text-neutral-200">
            {fam.guardian || 'No guardian named'}
            {fam.contact ? <span className="text-neutral-400"> · {fam.contact}</span> : null}
            <span className="block text-[11.5px] text-neutral-500">Has a private family link. Manage it in the planner’s People › Parents.</span>
          </div>
        ) : (
          <div className="mt-1 text-neutral-400">No family on file yet.</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={'/console?tab=people&q=' + encodeURIComponent(name)} className="btn btn-secondary min-h-11 px-4">
          Edit on People
        </Link>
        <Link href={'/planner/people?tab=parents&q=' + encodeURIComponent(name)} className="btn btn-ghost min-h-11 px-3 text-accent-300">
          Family &amp; slips
        </Link>
      </div>
    </>
  );
}

export function StudentSearch() {
  const d = useApp((s) => s.data);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  /* A link on the card navigates; the card closes once the page has moved
     (closing it first would step back over the navigation). */
  const where = usePathname() + '?' + useSearchParams().toString();
  const [seen, setSeen] = useState(where);
  if (where !== seen) {
    setSeen(where);
    setOpen(null);
  }
  const needle = q.trim().toLowerCase();
  const hits = needle ? d.roster.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, 8) : [];
  const pick = (name: string) => {
    setOpen(name);
    setQ('');
  };
  return (
    <div className="relative hidden md:block">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) pick(hits[0].name);
          if (e.key === 'Escape') setQ('');
        }}
        className="input min-h-11 w-[220px]"
        placeholder="Search students by name…"
        aria-label="Search students by name"
        role="combobox"
        aria-expanded={!!needle}
        aria-controls="student-search-results"
        aria-autocomplete="list"
      />
      {needle ? (
        <div id="student-search-results" role="listbox" aria-label="Students" className="absolute left-0 right-0 top-[48px] z-40 max-h-[320px] overflow-y-auto rounded-md border border-neutral-800 bg-surface shadow-lg">
          {hits.map((r) => {
            const t = teamOf(d, r.team);
            return (
              <button key={r.id} role="option" aria-selected={false} onClick={() => pick(r.name)} className="flex w-full items-center gap-[9px] border-t border-divider px-3 py-[10px] text-left first:border-t-0 hover:bg-neutral-900">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: t.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-neutral-100">{r.name}</span>
                  <span className="block text-[11px] text-neutral-400">
                    {r.team ? t.name : 'No squad'} · Grade {r.grade || '—'}
                    {r.captain ? ' · Captain' : ''}
                  </span>
                </span>
              </button>
            );
          })}
          {!hits.length ? <div className="px-3 py-3 text-[12px] text-neutral-500">No students match.</div> : null}
        </div>
      ) : null}
      <Sheet open={!!open} onClose={() => setOpen(null)} label={open ? 'Student: ' + open : 'Student'} maxH="90%">
        {open ? <StudentCard name={open} /> : null}
        <button onClick={() => setOpen(null)} className="btn btn-ghost min-h-11 justify-center">
          <Icon name="ph ph-x" className="mr-[6px] text-[13px]" />
          Close
        </button>
      </Sheet>
    </div>
  );
}
