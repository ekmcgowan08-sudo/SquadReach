'use client';
/* LIBRARY — lift a week, a game, a guide or a whole season into your own
   plan. A shared unit is credited to the ministry that wrote it, and its
   point values are theirs until you say otherwise: nothing is rescaled. */
import { shareBlockers } from '@/lib/library-share';
import { useState } from 'react';
import { sgMinutes } from '@/components/screens/season';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { LIB_KINDS, kindOf } from '@/lib/library';
import { canApprove } from '@/lib/permissions';
import { fmt } from '@/lib/scoring';
import { catOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { LibraryPlacement, LibraryUnit } from '@/lib/types/model';

const chip = (on: boolean) => ({
  border: '1px solid ' + (on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)'),
  background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
});
const kicker = 'text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500';

export function LibraryScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const leader = canApprove(m.persona);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'ours' | 'shared'>('all');
  const [open, setOpen] = useState<LibraryUnit | null>(null);
  const [share, setShare] = useState(false);
  const needle = q.trim().toLowerCase();
  const rows = d.library
    .filter((u) => !kind || u.kind === kind)
    .filter((u) => (scope === 'ours' ? !u.church : scope === 'shared' ? !!u.church : true))
    .filter((u) => !needle || [u.title, u.summary, u.theme, u.church ?? ''].join(' ').toLowerCase().includes(needle));

  const savePlaced = (fn: (list: LibraryPlacement[]) => LibraryPlacement[]) => {
    api().mutate((x) => void (x.libraryPlaced = fn(x.libraryPlaced)));
    api().emit({ kind: 'doc', key: 'libraryPlaced', value: api().data.libraryPlaced });
  };

  return (
    <Screen label="Library">
      <ScreenHeader
        title="Library"
        back="/dashboard/more"
        right={
          leader ? (
            <button onClick={() => setShare(true)} className="min-h-11 rounded-full border border-accent-600 px-[13px] text-[12px] font-semibold leading-none text-accent-200">
              Share ours
            </button>
          ) : undefined
        }
      />
      <label className="field !m-0">
        <span className="sr-label">Search the library</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="a lesson, a game, a theme, a church" />
      </label>
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="text-[11.5px] leading-[1.4] text-neutral-500">{rows.length === 1 ? '1 unit' : rows.length + ' units'}</div>
        {q ? (
          <button onClick={() => setQ('')} className="min-h-11 rounded-full border border-neutral-800 px-3 text-[11.5px] font-medium leading-none text-neutral-300">
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
        {[{ id: null as string | null, label: 'Everything', icon: 'ph ph-squares-four' }, ...LIB_KINDS].map((k) => (
          <button key={k.id ?? 'all'} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className="flex min-h-11 flex-none items-center gap-[6px] rounded-full px-[13px] text-[12px] font-medium leading-none" style={chip(kind === k.id)}>
            <Icon name={k.icon} className="text-[14px]" />
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex gap-[6px]">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'ours', label: 'Ours' },
            { id: 'shared', label: 'Shared with us' }
          ] as const
        ).map((k) => (
          <button key={k.id} onClick={() => setScope(k.id)} aria-pressed={scope === k.id} className="min-h-11 flex-none rounded-full px-[13px] text-[12px] font-medium leading-none" style={chip(scope === k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      {!leader ? <div className="rounded-md border border-neutral-800 px-[13px] py-[11px] text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">Browse anything here. Placing a unit on the season is your youth pastor’s call — tell them what you’d run.</div> : null}

      {d.libraryPlaced.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className={kicker}>Placed on the plan</div>
          {d.libraryPlaced.map((p) => (
            <div key={p.id} className="sr-card flex items-center gap-[10px] px-[13px] py-[10px]">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-[1.3] text-neutral-100">{p.title}</div>
                <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">
                  {kindOf(p.kind).one} · Week {p.week} · {p.pts === 'theirs' ? 'their point values' : 'our point values'}
                  {p.credit ? ' · from ' + p.credit : ''}
                </div>
              </div>
              {leader ? (
                <button aria-label="Remove from the plan" onClick={() => savePlaced((list) => list.filter((x) => x.id !== p.id))} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-400">
                  <Icon name="ph ph-x" className="text-[13px]" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {rows.length ? (
        <div className="flex flex-col gap-[8.4px]">
          {rows.map((u) => {
            const placed = d.libraryPlaced.find((p) => p.unit === u.id);
            return (
              <button key={u.id} onClick={() => setOpen(u)} className="sr-card sr-hover block w-full animate-[sr-rise_.25s_ease_both] px-[15px] py-[16.8px] text-left">
                <div className="flex items-center gap-[7px]">
                  <Icon name={kindOf(u.kind).icon} className="text-[14px] text-accent-400" />
                  <span className="text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-400">{kindOf(u.kind).one}</span>
                  <span className="text-[11px] leading-none text-neutral-500">· {u.span}</span>
                  <span className="ml-auto text-[10.5px] leading-none" style={{ color: u.church ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                    {u.church ?? 'Ours'}
                  </span>
                </div>
                <div className="mt-[11.2px] text-[15px] font-medium leading-[1.25] text-neutral-100">{u.title}</div>
                <div className="mt-[5px] text-[12px] leading-[1.5] text-neutral-400 text-pretty">{u.summary}</div>
                <div className="mt-[11.2px] flex flex-wrap items-center gap-[10px]">
                  <span className="text-[11px] leading-[1.3] text-neutral-500">{u.theme}</span>
                  <span className="text-[11px] leading-[1.3] text-neutral-500">· {u.used}</span>
                  {placed ? <span className="ml-auto text-[10.5px] font-semibold leading-none text-accent-200">On week {placed.week}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="sr-card px-4 py-[22px] text-center text-[12.5px] leading-[1.6] text-neutral-400 text-pretty">
          {d.library.length ? 'Nothing matches that. Try a theme — belonging, service, scripture.' : 'The library is empty for now. Share one of your small groups to start it, and units other ministries share land here.'}
        </div>
      )}

      <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Shared units carry the lesson, the game, the verse and the point values. They never carry anything about a student.</div>

      {open ? <UnitSheet key={open.id} unit={open} onClose={() => setOpen(null)} onPlace={(p) => savePlaced((list) => [p, ...list.filter((x) => x.unit !== p.unit)])} /> : null}
      {share ? <ShareSheet onClose={() => setShare(false)} /> : null}
    </Screen>
  );
}

function UnitSheet({ unit, onClose, onPlace }: { unit: LibraryUnit; onClose: () => void; onPlace: (p: LibraryPlacement) => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const leader = canApprove(m.persona);
  const needsChoice = !!unit.church && unit.pts.length > 0;
  const [week, setWeek] = useState<number | null>(null);
  const [pts, setPts] = useState<'theirs' | 'ours' | null>(needsChoice ? null : 'theirs');

  const place = () => {
    if (!week) return api().say('Pick the week it lands on.');
    if (!pts) return api().say('Confirm whose point values this week uses.');
    onPlace({
      id: uid(),
      unit: unit.id,
      title: unit.title,
      kind: unit.kind,
      week,
      pts,
      at: nowMs(),
      copy: { summary: unit.summary, includes: [...unit.includes], pts: unit.pts.map(([c, n]) => [c, n] as [string, number]), span: unit.span, theme: unit.theme },
      credit: unit.church
    });
    api().logActivity('Placed “' + unit.title + '” on Week ' + week + (unit.church ? ' — from ' + unit.church + ', ' + (pts === 'theirs' ? 'their point values' : 'our point values') : ''));
    api().say('On Week ' + week + '. It shows on the Season plan.');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} label={unit.title} z={88} maxH="88%">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-400">
            {kindOf(unit.kind).one} · {unit.span}
          </div>
          <div className="mt-[7px] text-[20px] font-medium leading-[1.2] text-neutral-100">{unit.title}</div>
        </div>
        <button aria-label="Close" onClick={onClose} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
          <Icon name="ph ph-x" className="text-[13px]" />
        </button>
      </div>
      {unit.church ? (
        <div className="flex items-center gap-2 rounded-md border border-accent-700 px-[13px] py-[10px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
          <Icon name="ph ph-hand-heart" className="text-[15px] text-accent-300" />
          <div className="text-[11.5px] leading-[1.45] text-neutral-300 text-pretty">Shared by {unit.church} — credited on every copy. Nothing about their students came with it.</div>
        </div>
      ) : null}
      <div className="text-[12.5px] leading-[1.6] text-neutral-300 text-pretty">{unit.summary}</div>
      <div className="flex flex-col gap-[8.4px]">
        <div className={kicker}>What is inside</div>
        {unit.includes.map((i) => (
          <div key={i} className="flex min-h-[26px] items-center gap-[9px]">
            <Icon name="ph ph-check" className="text-[13px] text-accent-400" />
            <div className="text-[12.5px] leading-[1.4] text-neutral-200">{i}</div>
          </div>
        ))}
      </div>
      {unit.pts.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className={kicker}>Point values it suggests</div>
          {unit.pts.map(([cat, amt]) => (
            <div key={cat} className="flex min-h-7 items-center gap-[10px] border-b border-divider">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: catOf(d, cat).color }} />
              <div className="flex-1 text-[12.5px] leading-[1.3] text-neutral-200">{catOf(d, cat).label}</div>
              <div className="tabular text-[12.5px] font-semibold leading-[1.3] text-neutral-100">{fmt(amt)}</div>
            </div>
          ))}
        </div>
      ) : null}
      {leader ? (
        <>
          {needsChoice ? (
            <div className="flex flex-col gap-[10px] rounded-md border border-neutral-800 p-[13px]">
              <div className="text-[12.5px] font-medium leading-[1.45] text-neutral-100 text-pretty">These are their numbers, not yours. Which does this week use?</div>
              <div className="flex flex-wrap gap-[7px]">
                {(['theirs', 'ours'] as const).map((v) => (
                  <button key={v} onClick={() => setPts(v)} aria-pressed={pts === v} className="min-h-11 min-w-[140px] flex-1 rounded-full border border-accent-600 px-[13px] text-[12px] font-medium leading-none" style={{ background: pts === v ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent', color: pts === v ? 'var(--color-accent-100)' : 'var(--color-neutral-300)' }}>
                    {v === 'theirs' ? 'Use their values' : 'Keep our values'}
                  </button>
                ))}
              </div>
              <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Nothing is rescaled for you. A church that pays 600 for a visitor made that call about its own board.</div>
            </div>
          ) : null}
          <div className="flex flex-col gap-[8.4px]">
            <div className={kicker}>Which week does it land on</div>
            <div className="flex flex-wrap gap-[6px]">
              {Array.from({ length: d.config.seasonWeeks }, (_, i) => i + 1).map((w) => (
                <button key={w} onClick={() => setWeek(w)} aria-pressed={week === w} className="min-h-11 flex-none rounded-full px-[13px] text-[12px] font-medium leading-none" style={chip(week === w)}>
                  Week {w}
                </button>
              ))}
            </div>
          </div>
          <Btn className="min-h-12 justify-center" onClick={place}>
            {week ? 'Place on Week ' + week : 'Place on the plan'}
          </Btn>
        </>
      ) : null}
    </Sheet>
  );
}

/** Leaders publish one of their small-group guides for other ministries:
 *  pick one, see exactly what leaves the ministry, then confirm. A unit that
 *  names anyone the ministry knows doesn't go (lib/library-share). */
function ShareSheet({ onClose }: { onClose: () => void }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const [pick, setPick] = useState<string | null>(null);
  const shared = new Set(d.library.filter((u) => !u.church).map((u) => u.title));
  const unitFor = (gId: string): LibraryUnit | null => {
    const g = d.smallGroups.find((x) => x.id === gId);
    if (!g) return null;
    return {
      id: uid(),
      kind: 'guide',
      title: g.title.replace(/^Week \d+ · /, ''),
      church: null,
      span: g.screens.length + ' screens',
      theme: g.deepDive ? 'Scripture' : 'Small group',
      summary: g.notes || 'A small group guide from ' + d.config.ministryName + '.',
      includes: [g.screens.length + ' screens', 'About ' + sgMinutes(g.screens) + ' min', ...(g.deepDive ? ['Five-day go-deeper track'] : [])],
      pts: [],
      used: 'Shared by you'
    };
  };
  const unit = pick ? unitFor(pick) : null;
  const names = unit ? shareBlockers(unit, d) : [];
  const publish = async () => {
    if (!unit || names.length) return;
    /* Supabase: wait for the database's own check before saying it's shared. */
    if (api().backend.mode === 'supabase') {
      try {
        await api().backend.sync({ kind: 'libraryShare', unit });
      } catch (e) {
        api().say(e instanceof Error && /names/.test(e.message) ? e.message : 'It didn’t share — check your signal and try again.');
        return;
      }
    }
    api().mutate((x) => void x.library.unshift(unit));
    api().logActivity('Shared the guide “' + unit.title + '” to the library');
    api().say('Shared. Other ministries see it credited to ' + d.config.ministryName + '.');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} label="Share to the library">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Share to the library</div>
      {!unit ? (
        <>
          <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Pick a small group guide. Other ministries get the screens and your notes, credited to {d.config.ministryName} — you’ll see exactly what goes before it goes.</div>
          {d.smallGroups.map((g) => {
            const done = shared.has(g.title.replace(/^Week \d+ · /, ''));
            return (
              <button key={g.id} disabled={done} onClick={() => setPick(g.id)} className="flex min-h-12 items-center gap-[10px] rounded-md border border-neutral-800 px-3 text-left disabled:opacity-50">
                <Icon name="ph ph-users-three" className="text-[15px] text-accent-400" />
                <span className="flex-1 text-[12.5px] font-medium leading-[1.3] text-neutral-200">{g.title}</span>
                <span className="text-[10.5px] leading-none text-neutral-500">{done ? 'Shared' : g.screens.length + ' screens'}</span>
              </button>
            );
          })}
          {!d.smallGroups.length ? <div className="text-[12px] text-neutral-500">No small groups yet — build one on Season › Small groups.</div> : null}
        </>
      ) : (
        <>
          <div className="text-[11.5px] leading-[1.5] text-neutral-500">This is everything other ministries will see:</div>
          <div className="flex flex-col gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-3">
            <div className="text-[14px] font-medium text-neutral-100">{unit.title}</div>
            <div className="text-[11px] text-neutral-500">
              {unit.theme} · {unit.includes.join(' · ')} · from {d.config.ministryName}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-neutral-300">{unit.summary}</div>
          </div>
          {names.length ? (
            <div role="alert" className="rounded-md border border-[oklch(0.66_0.11_24)] px-3 py-2 text-[12px] leading-[1.5] text-neutral-200">
              It names {names.join(', ')}. Take {names.length === 1 ? 'that name' : 'those names'} out of the guide’s notes before sharing it — other ministries can read the library.
            </div>
          ) : null}
          <div className="flex gap-2">
            <Btn className="flex-1 justify-center" disabled={!!names.length} onClick={() => void publish()}>
              Share with other ministries
            </Btn>
            <Btn variant="ghost" className="px-4" onClick={() => setPick(null)}>
              Back
            </Btn>
          </div>
        </>
      )}
    </Sheet>
  );
}
