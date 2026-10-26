'use client';
/* Planning Center on the phone and the console: pulling tonight's
   check-ins into attendance, and the People tab's connect / import panel.
   Every call goes through the app's own /api/pco routes; the browser never
   holds a Planning Center token. */
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { Btn, Icon } from '@/components/ui';
import { importPreview, matchRoster, studentsOnly, type PcoPerson } from '@/lib/pco';
import { canApprove, canEditRoster } from '@/lib/permissions';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Student } from '@/lib/types/model';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Planning Center didn’t answer (' + r.status + ').');
  return j;
}

/** "Pull check-ins from Planning Center" — for whoever takes attendance,
 *  once the ministry has connected it. Marks matching roster names here. */
export function PcoCheckInsButton() {
  const pco = useApp((s) => s.data.pco);
  const persona = useApp((s) => s.membership.persona);
  const night = useApp((s) => s.data.tonight.date);
  const api = useAppApi();
  const [busy, setBusy] = useState(false);
  if (!pco?.connected || !canEditRoster(persona) || !night) return null;
  const pull = async () => {
    setBusy(true);
    try {
      /* The night, midnight to midnight on this phone's clock. */
      const from = new Date(night + 'T00:00:00');
      const to = new Date(from.getTime() + 24 * 3600_000);
      const { names } = await call<{ names: string[] }>('/api/pco/checkins?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString()));
      const d = api().data;
      const { matched, unknown } = matchRoster(names, d.roster);
      const fresh = matched.filter((n) => !d.tonight.presence[n]);
      for (const n of fresh) api().setPresence(n, true, 'pco');
      if (fresh.length) api().logActivity('Pulled ' + fresh.length + ' check-in' + (fresh.length === 1 ? '' : 's') + ' from Planning Center');
      api().say(
        (fresh.length ? fresh.length + ' marked here from Planning Center' : names.length ? 'Everyone Planning Center checked in is already here' : 'Nobody has checked in through Planning Center tonight yet') +
          (unknown.length ? ' · not on a roster: ' + unknown.slice(0, 4).join(', ') + (unknown.length > 4 ? ' and ' + (unknown.length - 4) + ' more' : '') : '') +
          '.'
      );
    } catch (e) {
      api().say(e instanceof Error ? e.message : 'Planning Center didn’t answer.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Btn variant="secondary" className="justify-center text-[12px]" onClick={() => void pull()} disabled={busy}>
      <Icon name="ph ph-plugs-connected" className="mr-[6px] text-[15px]" />
      {busy ? 'Asking Planning Center…' : 'Pull check-ins from Planning Center'}
    </Btn>
  );
}

const OUTCOMES: Record<string, string> = {
  connected: 'Planning Center is connected.',
  declined: 'Planning Center wasn’t connected — the request was declined there.',
  unavailable: 'Planning Center isn’t set up on this server yet.',
  error: 'Planning Center couldn’t be connected.'
};

/** Console › People: connect Planning Center, and import students from it. */
export function PcoSection({ onImport }: { onImport: (rows: Student[]) => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const params = useSearchParams();
  const outcome = params.get('pco');
  const [lists, setLists] = useState<{ id: string; name: string }[] | null>(null);
  const [list, setList] = useState('');
  const [people, setPeople] = useState<PcoPerson[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const entry = d.plan.settings.entryGrade || 6;

  if (m.mode === 'demo')
    return (
      <Section title="Planning Center" sub="Bring the roster in from the church’s people database instead of typing it.">
        <p className="text-[12.5px] leading-[1.6] text-neutral-400 text-pretty">
          On the live app a leader connects the church’s Planning Center once. Then students in grades {entry}–12 (or any Planning Center list) import into the roster in one go, and tonight’s Planning Center check-ins mark people here on Night recap. SquadRise only reads; it never changes anything in Planning Center.
        </p>
      </Section>
    );
  if (!canApprove(m.persona)) return null;

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Planning Center didn’t answer.');
    } finally {
      setBusy(false);
    }
  };
  const load = () =>
    run(async () => {
      const r = await call<{ people: PcoPerson[] }>('/api/pco/people' + (list ? '?list=' + encodeURIComponent(list) : ''));
      setPeople(list ? r.people.filter((p) => p.active) : studentsOnly(r.people, { from: entry, to: 12 }));
    });
  const preview = people ? importPreview(people, d.roster) : null;
  const connected = d.pco?.connected;

  return (
    <Section
      title="Planning Center"
      sub={connected ? 'Connected' + (d.pco?.org ? ' to ' + d.pco.org : '') + (d.pco?.at ? ' since ' + new Date(d.pco.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '') + '. SquadRise reads people and check-ins; it never changes anything there.' : 'Bring the roster in from the church’s people database, and pull check-ins on the night. SquadRise only reads.'}
      right={
        connected ? (
          <Btn
            variant="ghost"
            className="px-3 text-[12px] text-neutral-400"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Disconnect Planning Center? Nothing in Planning Center changes; you can connect again any time.')) return;
              void run(async () => {
                await call('/api/pco/disconnect', { method: 'POST' });
                api().mutate((x) => void (x.pco = { connected: false }));
                setPeople(null);
                api().say('Planning Center disconnected.');
              });
            }}
          >
            Disconnect
          </Btn>
        ) : (
          /* A full page load: the route sends the leader on to Planning Center. */
          <a className="btn btn-primary px-4" href="/api/pco/connect">
            <Icon name="ph ph-plugs-connected" className="mr-[6px] text-[15px]" />
            Connect Planning Center
          </a>
        )
      }
    >
      {outcome && OUTCOMES[outcome] ? (
        <div role="status" className="rounded-md border border-neutral-800 px-3 py-2 text-[12px] text-neutral-300">
          {OUTCOMES[outcome]}
          {params.get('why') ? ' ' + params.get('why') : ''}
        </div>
      ) : null}
      {connected ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="field !m-0 min-w-[260px] flex-1">
              <span>Import from</span>
              <select
                className="input"
                value={list}
                onFocus={() => {
                  if (!lists) void run(async () => setLists((await call<{ lists: { id: string; name: string }[] }>('/api/pco/lists')).lists));
                }}
                onChange={(e) => {
                  setList(e.target.value);
                  setPeople(null);
                }}
              >
                <option value="">Everyone in grades {entry}–12</option>
                {(lists ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    The list “{l.name}”
                  </option>
                ))}
              </select>
            </label>
            <Btn variant="secondary" className="px-4" disabled={busy} onClick={() => void load()}>
              {busy ? 'Asking Planning Center…' : people ? 'Look again' : 'See who would come in'}
            </Btn>
          </div>
          {preview ? (
            <div className="flex flex-col gap-2 rounded-md border border-neutral-800 px-4 py-3">
              <div className="text-[13px] text-neutral-100">
                {preview.add.length} new {preview.add.length === 1 ? 'student' : 'students'}
                {preview.already.length ? <span className="text-neutral-400"> · {preview.already.length} already on the roster</span> : null}
              </div>
              {preview.add.length ? (
                <div className="text-[12px] leading-[1.6] text-neutral-400">
                  {preview.add
                    .slice(0, 24)
                    .map((s) => s.name + (s.grade ? ' (' + s.grade + ')' : ''))
                    .join(', ')}
                  {preview.add.length > 24 ? ' and ' + (preview.add.length - 24) + ' more' : ''}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <Btn
                  className="px-4"
                  disabled={!preview.add.length}
                  onClick={() => {
                    onImport(preview.add);
                    api().logActivity('Imported ' + preview.add.length + ' students from Planning Center');
                    api().say(preview.add.length + ' added from Planning Center. Coaches place them in squads.');
                    setPeople(null);
                  }}
                >
                  Import {preview.add.length || ''}
                </Btn>
                <span className="text-[11.5px] text-neutral-500">They arrive without a squad; nothing about them goes back to Planning Center.</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12.5px] text-[oklch(0.78_0.12_40)]">
          {error}
        </p>
      ) : null}
    </Section>
  );
}
