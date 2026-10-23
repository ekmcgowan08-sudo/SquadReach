'use client';
/* People: the student roster (squads, grades, captains, CSV import) and the
   adults and students who hold a role in the app. */
import Link from 'next/link';
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { Btn, Icon } from '@/components/ui';
import { DEMO_PEOPLE } from '@/lib/data/seed';
import { teamOf } from '@/lib/selectors';
import { parseRoster } from '@/lib/roster';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { MEMBERSHIP_ROLES, ROLE_LABELS, type MembershipRole } from '@/lib/types/domain';
import type { PersonRow, Student } from '@/lib/types/model';

export function PeopleTab() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const [q, setQ] = useState('');
  const [squad, setSquad] = useState<string>('');
  const [paste, setPaste] = useState('');
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newTeam, setNewTeam] = useState<string>(d.teams[0]?.id ?? '');
  const needle = q.trim().toLowerCase();
  const roster = d.roster
    .filter((r) => !squad || (squad === 'none' ? !r.team : r.team === squad))
    .filter((r) => !needle || r.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pending = d.accessRequests.filter((r) => r.status === 'pending').length;

  const saveStudent = (s: Student) => {
    api().mutate((x) => {
      const i = x.roster.findIndex((y) => y.id === s.id);
      if (i >= 0) x.roster[i] = s;
      else x.roster.push(s);
    });
    api().emit({ kind: 'student', student: s });
  };
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (d.roster.some((r) => r.name.toLowerCase() === name.toLowerCase())) return api().say(name + ' is already on the roster.');
    saveStudent({ id: uid(), name, grade: newGrade.trim(), team: newTeam || null });
    api().logActivity('Added ' + name + ' to the roster');
    setNewName('');
    setNewGrade('');
  };
  const importRows = () => {
    const { rows, skipped } = parseRoster(paste, d.teams);
    const fresh = rows.filter((r) => !d.roster.some((x) => x.name.toLowerCase() === r.name.toLowerCase()));
    for (const r of fresh) saveStudent(r);
    api().logActivity('Imported ' + fresh.length + ' students to the roster');
    api().say(fresh.length + ' added' + (rows.length - fresh.length ? ', ' + (rows.length - fresh.length) + ' already here' : '') + (skipped.length ? ', ' + skipped.length + ' lines skipped' : '') + '.');
    setPaste('');
  };

  return (
    <>
      <Section
        title={'Roster · ' + d.roster.length + ' students'}
        sub="Squad, grade and captain for every student. Names here are what coaches tap at check-in."
        right={
          pending ? (
            <Link href="/dashboard/access-requests" className="btn btn-secondary min-h-11 px-3">
              {pending} waiting on access
            </Link>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input min-w-[200px] flex-1" placeholder="Search the roster" aria-label="Search the roster" />
          <select value={squad} onChange={(e) => setSquad(e.target.value)} className="input w-auto" aria-label="Filter by squad">
            <option value="">All squads</option>
            {d.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {d.roster.filter((r) => r.team === t.id).length}
              </option>
            ))}
            <option value="none">Unassigned · {d.roster.filter((r) => !r.team).length}</option>
          </select>
        </div>
        <div className="max-h-[520px] overflow-auto rounded-md border border-neutral-800">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-surface text-[10.5px] uppercase tracking-[.08em] text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Grade</th>
                <th className="px-3 py-2 font-semibold">Squad</th>
                <th className="px-3 py-2 font-semibold">Captain</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id} className="border-t border-divider">
                  <td className="px-3 py-1 text-neutral-200">
                    {r.name}
                    {r.newInDb ? <span className="ml-2 rounded-full border border-accent-700 px-[6px] py-[2px] text-[9.5px] text-accent-300">added on the floor</span> : null}
                  </td>
                  <td className="px-3 py-1">
                    <input className="input !min-h-9 w-16 !py-0" defaultValue={r.grade} aria-label={'Grade for ' + r.name} onBlur={(e) => e.target.value !== r.grade && saveStudent({ ...r, grade: e.target.value.trim() })} />
                  </td>
                  <td className="px-3 py-1">
                    <select className="input !min-h-9 w-auto !py-0" value={r.team ?? ''} onChange={(e) => saveStudent({ ...r, team: e.target.value || null })} aria-label={'Squad for ' + r.name}>
                      <option value="">—</option>
                      {d.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1">
                    <input type="checkbox" checked={!!r.captain} onChange={(e) => saveStudent({ ...r, captain: e.target.checked })} aria-label={r.name + ' is a captain'} className="h-5 w-5 accent-[var(--color-accent)]" />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button
                      aria-label={'Remove ' + r.name}
                      onClick={() => {
                        if (!window.confirm('Remove ' + r.name + ' from the roster? Their points stay in the ledger.')) return;
                        api().mutate((x) => void (x.roster = x.roster.filter((y) => y.id !== r.id)));
                        api().emit({ kind: 'studentRemove', id: r.id });
                        api().logActivity('Removed ' + r.name + ' from the roster');
                      }}
                      className="h-9 w-9 rounded-full text-neutral-500 hover:text-out"
                    >
                      <Icon name="ph ph-trash" className="text-[13px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!roster.length ? <div className="px-3 py-6 text-center text-[12px] text-neutral-500">Nobody matches.</div> : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-[180px] flex-1">
            <span className="sr-label">Add a student</span>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="First and last name" onKeyDown={(e) => e.key === 'Enter' && add()} />
          </label>
          <label className="field w-20">
            <span className="sr-label">Grade</span>
            <input className="input" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} placeholder="8" />
          </label>
          <label className="field w-36">
            <span className="sr-label">Squad</span>
            <select className="input" value={newTeam} onChange={(e) => setNewTeam(e.target.value)}>
              <option value="">Unassigned</option>
              {d.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Btn className="px-4" onClick={add}>
            Add
          </Btn>
        </div>
        <label className="field">
          <span className="sr-label">Import — paste “Name, grade, squad” one per line (from a spreadsheet or Planning Center export)</span>
          <textarea className="input !min-h-24 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Ellison Reid, 8, Yellow\nIsaac Smith, 9, Red'} />
        </label>
        <div className="flex items-center gap-3">
          <Btn variant="secondary" className="px-4" disabled={!paste.trim()} onClick={importRows}>
            Import {paste.trim() ? parseRoster(paste, d.teams).rows.length : ''} students
          </Btn>
          <span className="text-[11.5px] text-neutral-500">Names already on the roster are skipped, so importing twice is safe.</span>
        </div>
      </Section>

      <Section title="Roles in the app" sub="Who can do what. Students join as members; a leader grants every other role.">
        {m.mode === 'demo' ? (
          <>
            <div className="text-[12px] text-neutral-500">On the demo, everyone below is a persona you can switch to from the avatar on Home.</div>
            <div className="flex flex-col">
              {Object.entries(DEMO_PEOPLE).map(([persona, p]) => (
                <div key={persona} className="flex items-center gap-3 border-t border-divider py-2 first:border-t-0">
                  <span className="flex-1 text-[13px] text-neutral-200">{p.displayName}</span>
                  <span className="text-[12px] text-neutral-500">{persona}</span>
                  <span className="text-[12px] text-neutral-500">{p.teamId ? teamOf(d, p.teamId).name : ''}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <PeopleList people={d.people ?? []} />
        )}
      </Section>
    </>
  );
}

function PeopleList({ people }: { people: PersonRow[] }) {
  const d = useApp((s) => s.data);
  const me = useApp((s) => s.membership.membershipId);
  const api = useAppApi();
  const save = (p: PersonRow) => {
    api().mutate((x) => {
      const i = (x.people ??= []).findIndex((y) => y.id === p.id);
      if (i >= 0) x.people[i] = p;
    });
    api().emit({ kind: 'person', person: p });
  };
  if (!people.length) return <div className="text-[12px] text-neutral-500">Nobody yet besides you. Share the invite code from Setup.</div>;
  return (
    <div className="flex flex-col">
      {people.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-divider py-2 first:border-t-0">
          <span className="min-w-[160px] flex-1 text-[13px] text-neutral-200">
            {p.name}
            {p.id === me ? <span className="ml-2 text-[11px] text-neutral-500">(you)</span> : null}
          </span>
          <select
            className="input !min-h-9 w-auto !py-0"
            value={p.role}
            disabled={p.id === me}
            onChange={(e) => {
              save({ ...p, role: e.target.value as MembershipRole });
              api().logActivity('Changed ' + p.name + '’s role to ' + ROLE_LABELS[e.target.value as MembershipRole]);
            }}
            aria-label={'Role for ' + p.name}
          >
            {MEMBERSHIP_ROLES.filter((r) => r !== 'owner' || p.role === 'owner').map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select className="input !min-h-9 w-auto !py-0" value={p.teamId ?? ''} onChange={(e) => save({ ...p, teamId: e.target.value || null })} aria-label={'Squad for ' + p.name}>
            <option value="">No squad</option>
            {d.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {p.role === 'member' || p.role === 'captain' ? (
            <select className="input !min-h-9 w-auto !py-0" value={p.studentName ?? ''} onChange={(e) => save({ ...p, studentName: e.target.value || null })} aria-label={'Which student ' + p.name + ' is'}>
              <option value="">Link to a student…</option>
              {d.roster.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : null}
          {p.id !== me && p.role !== 'owner' ? (
            <button
              aria-label={'Remove ' + p.name}
              onClick={() => {
                if (!window.confirm('Remove ' + p.name + ' as ' + ROLE_LABELS[p.role] + '? They lose access to this ministry.')) return;
                api().mutate((x) => void (x.people = (x.people ?? []).filter((y) => y.id !== p.id)));
                api().emit({ kind: 'personRemove', id: p.id });
                api().logActivity('Removed ' + p.name + ' as ' + ROLE_LABELS[p.role]);
              }}
              className="h-9 w-9 rounded-full text-neutral-500 hover:text-out"
            >
              <Icon name="ph ph-trash" className="text-[13px]" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
