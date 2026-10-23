'use client';
/* SCORE — squad × category × amount, live goal logging, and (merged in) the
   Live Now standings. SCORE_ENTRY_ROLES only. A deduction stops for a reason
   before it touches the ledger, because the entry outlives the night. */
import { useState } from 'react';
import { LiveNow } from '@/components/dashboard/standings-list';
import { StudentSheet } from '@/components/dashboard/student-sheet';
import { Btn, Icon, Screen } from '@/components/ui';
import { autoApproves } from '@/lib/permissions';
import { fmt, teamTotal } from '@/lib/scoring';
import { catOf, teamOf } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';
import { useSearchParams } from 'next/navigation';

const DEDUCT_REASONS = ['Bad sportsmanship', 'Disrespect', 'Broke a game rule', 'Left without checking out', 'Phones during teaching', 'Correcting a scoring mistake'];

const sel = (on: boolean, hex?: string) => ({
  borderColor: on ? hex ?? 'var(--color-accent-400)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, ' + (hex ?? 'var(--color-accent)') + ' 16%, var(--color-surface))' : 'var(--color-surface)'
});

export function ScoreScreen() {
  const d = useApp((s) => s.data);
  const persona = useApp((s) => s.membership.persona);
  const api = useAppApi();
  const params = useSearchParams();
  const [team, setTeam] = useState<string | null>(params.get('team'));
  const [cat, setCat] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [deduct, setDeduct] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [studentOpen, setStudentOpen] = useState(false);
  const base = api().base();
  const live = autoApproves(persona);
  const t = team ? teamOf(d, team) : null;
  const c = cat ? catOf(d, cat) : null;

  const quick = (amount: number) => {
    if (!team || !cat || !t || !c) {
      api().say('Pick a squad and a category first.');
      return;
    }
    if (amount < 0) {
      setDeduct(amount);
      setReason('');
      setNote('');
      return;
    }
    const flag = api().award({ team, cat, amount });
    if (!flag) return;
    const sign = amount > 0 ? '+' : '';
    api().sayPosted(
      sign + fmt(amount) + ' ' + c.label + ' → ' + t.name + (live ? '. Posted live.' : '. Sent for approval.'),
      sign + fmt(amount) + ' ' + c.label + ' → ' + t.name + '. Held until you have signal.'
    );
  };

  const confirmDeduct = () => {
    if (deduct == null || !team || !cat || !t) return;
    if (!reason) {
      api().say('Pick what it was for first.');
      return;
    }
    const why = reason + (note.trim() ? ' — ' + note.trim() : '');
    const flag = api().award({ team, cat, amount: deduct, why });
    setDeduct(null);
    if (!flag) return;
    api().sayPosted(fmt(deduct) + ' to ' + t.name + ' · ' + reason.toLowerCase() + '.', fmt(deduct) + ' held until you have signal · ' + reason.toLowerCase() + '.');
  };

  const goal = (teamId: string) => {
    const val = d.config.goalValue;
    const flag = api().award({ team: teamId, cat: 'games', amount: val, why: 'live goal', by: api().membership.displayName + ' · live goal' });
    if (!flag) return;
    api().mutate((x) => {
      x.tonight.goals[teamId] = (x.tonight.goals[teamId] || 0) + 1;
    });
    api().sayPosted('+' + fmt(val) + ' Games → ' + teamOf(d, teamId).name + ' scores.', '+' + fmt(val) + ' Games held until you have signal.');
  };

  return (
    <Screen label="Score points">
      <div className="flex items-start justify-between gap-[10px]">
        <div>
          <div className="text-[10.5px] font-semibold uppercase leading-none tracking-[.13em] text-accent-400">
            Week {d.config.weekNumber} · base {fmt(base)} pts
          </div>
          <h1 className="mt-[7px] text-[25px] font-medium leading-[1.15] text-neutral-100">Score a squad</h1>
        </div>
        <div className="max-w-[118px] text-right text-[10.5px] leading-[1.4] text-neutral-500">
          {live ? 'Posts land on the board immediately — your role is trusted for the ledger' : 'Posts go to the approval queue for a leader to review'}
        </div>
      </div>

      <div className="flex w-fit items-center gap-2 rounded-full border border-accent-700 px-3 py-2" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
        <Icon name="ph-fill ph-trend-up" className="text-[13px] text-accent-300" />
        <span className="text-[11.5px] font-semibold leading-none text-accent-200">
          Week {d.config.weekNumber} base {fmt(base)} pts · set by the youth pastor
        </span>
      </div>

      <div>
        <div className="mb-[9px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">1 · Squad</div>
        <div className="grid grid-cols-2 gap-[9px]">
          {d.teams.map((x) => (
            <button key={x.id} onClick={() => setTeam(x.id)} aria-pressed={team === x.id} className="flex min-h-[62px] flex-col gap-[5px] rounded-lg border px-3 py-[11px] text-left" style={sel(team === x.id, x.color)}>
              <div className="flex items-center gap-[7px]">
                <span className="h-[10px] w-[10px] rounded-full" style={{ background: x.color }} />
                <span className="text-[13.5px] font-medium leading-none text-neutral-100">{x.name}</span>
              </div>
              <div className="text-[11px] leading-none text-neutral-500">{fmt(teamTotal(d.ledger, x.id))} pts</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-[9px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">2 · Category</div>
        <div className="flex flex-col gap-2">
          {d.cats.map((x) => (
            <button key={x.id} onClick={() => setCat(x.id)} aria-pressed={cat === x.id} className="flex min-h-[52px] items-center gap-[11px] rounded-lg border px-[13px] py-[11px] text-left" style={sel(cat === x.id, x.color)}>
              <Icon name={x.icon} className="text-[18px]" style={{ color: x.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium leading-none text-neutral-100">{x.label}</div>
                <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">{x.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {cat === 'games' && t ? (
        <div className="sr-card px-[14px] pb-[14px] pt-[13px]">
          <div className="mb-[10px] flex items-center gap-2">
            <Icon name="ph-fill ph-soccer-ball" className="text-[15px] text-accent-400" />
            <span className="text-[13px] font-medium leading-none text-neutral-100">Live goal</span>
            <span className="ml-auto text-[11px] leading-none text-neutral-500">+{fmt(d.config.goalValue)} per goal</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {d.teams.map((x) => (
              <button key={x.id} onClick={() => goal(x.id)} className="flex min-h-12 items-center justify-between gap-2 rounded-md border px-[11px] py-[9px]" style={sel(team === x.id, x.color)}>
                <span className="text-[12.5px] font-medium leading-none" style={{ color: team === x.id ? 'var(--color-accent-100)' : 'var(--color-neutral-300)' }}>
                  {x.name}
                </span>
                <span className="tabular text-[13px] font-semibold leading-none text-accent-200">{d.tonight.goals[x.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button onClick={() => setStudentOpen(true)} className="flex min-h-[52px] items-center gap-[11px] rounded-lg border border-neutral-800 bg-surface px-[14px] text-left hover:border-accent-600">
        <Icon name="ph ph-user-focus" className="text-[18px] text-accent-400" />
        <div className="flex-1">
          <div className="text-[13px] font-medium leading-[1.2] text-neutral-200">Log one student instead</div>
          <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">Attendance, Bible, verses, shirt, volunteering, friends</div>
        </div>
        <Icon name="ph ph-caret-right" className="text-[13px] text-neutral-600" />
      </button>

      <div>
        <div className="mb-[9px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">3 · Award</div>
        <div className="sr-card px-[15px] pb-[15px] pt-[14px]">
          <div className="mb-3 text-[12.5px] leading-[1.4] text-neutral-400">
            {t && c ? c.label + ' points to ' + t.name + ' · Week ' + d.config.weekNumber + ' scale' : 'Pick a squad and a category, then award.'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[-2 * base, -base, base, 2 * base].map((n) => (
              <button
                key={n}
                onClick={() => quick(n)}
                className="tabular min-h-[52px] rounded-md border text-[17px] font-semibold leading-none"
                style={{
                  borderColor: n > 0 ? 'var(--color-accent-600)' : 'var(--color-neutral-800)',
                  background: n > 0 ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                  color: n > 0 ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
                }}
              >
                {(n > 0 ? '+' : '−') + fmt(Math.abs(n))}
              </button>
            ))}
          </div>
          <div className="mt-[10px] flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              inputMode="numeric"
              placeholder="Custom amount"
              aria-label="Custom amount"
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click()}
            />
            <button
              onClick={() => {
                const n = parseInt(custom.replace(/[^0-9-]/g, ''), 10);
                if (!n) {
                  api().say('Type an amount first.');
                  return;
                }
                setCustom('');
                quick(n);
              }}
              className="min-h-11 min-w-20 rounded-md border border-accent-600 text-[13px] font-semibold leading-none text-accent-200"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }}
            >
              Add
            </button>
          </div>
          {deduct != null ? (
            <div className="mt-[11px] rounded-md border border-neutral-800 bg-neutral-900 p-[13px]">
              <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-200">{t ? 'Why ' + fmt(deduct) + ' from ' + t.name + '?' : 'Why the deduction?'}</div>
              <div className="mt-[3px] text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">Taking points away needs a reason on the record. Students and parents can see it, so say what happened.</div>
              <div className="mt-[11px] flex flex-wrap gap-[6px]">
                {DEDUCT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    aria-pressed={reason === r}
                    className="min-h-11 rounded-full border px-3 text-[11.5px] font-medium leading-none"
                    style={{
                      borderColor: reason === r ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
                      background: reason === r ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                      color: reason === r ? 'var(--color-accent-200)' : 'var(--color-neutral-300)'
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-[9px]" placeholder="Anything else worth writing down (optional)" aria-label="Note" />
              <div className="mt-[10px] flex flex-wrap gap-2">
                <Btn className="flex-1 justify-center px-[14px]" onClick={confirmDeduct}>
                  Take {fmt(Math.abs(deduct))} away
                </Btn>
                <Btn variant="ghost" className="px-[14px]" onClick={() => setDeduct(null)}>
                  Never mind
                </Btn>
              </div>
            </div>
          ) : null}
          <button onClick={() => api().undoLast()} className="mt-[10px] min-h-11 w-full rounded-md border border-neutral-800 text-[12.5px] font-medium leading-none text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            Undo last entry (posts a reversal)
          </button>
          <div className="mt-[10px] text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">
            The ledger is append-only. Nothing here edits or deletes a past entry — an undo writes its opposite, and both stay in the audit log.
          </div>
        </div>
      </div>

      <LiveNow />
      {studentOpen ? <StudentSheet open onClose={() => setStudentOpen(false)} initialTeam={team ?? undefined} /> : null}
    </Screen>
  );
}
