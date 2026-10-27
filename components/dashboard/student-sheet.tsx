'use client';
/* "Log a student" — the check-in sheet holds detail, not just a checkbox.
   A row with an `expand` type opens its panel in the same tap that turns it
   on: friends (how many, and their names), articles (1–5, cumulative),
   verses (how many of the board), proof (optional photo, pays a bonus) and
   where (which service). */
import { useMemo, useRef, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon } from '@/components/ui';
import {
  ENSEMBLE_BONUS, PROOF_BONUS, STUDENT_ITEMS, WORSHIP_PLACES, emptySheet, fmt, parseFriendNames, sheetFriendCount,
  sheetTotal, studentItemValue, verseCount, type SheetState
} from '@/lib/scoring';
import { catOf, computeBadges, teamOf } from '@/lib/selectors';
import { postStudentSheet, valueCtx } from '@/lib/store/actions';
import { useApp, useAppApi } from '@/lib/store/provider';
import { canEditRoster } from '@/lib/permissions';

const sel = (on: boolean, hex?: string) => ({
  borderColor: on ? hex ?? 'var(--color-accent-400)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, ' + (hex ?? 'var(--color-accent)') + ' 16%, var(--color-surface))' : 'var(--color-surface)',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-300)'
});

export function StudentSheet({ open, onClose, initialTeam, initialName }: { open: boolean; onClose: () => void; initialTeam?: string; initialName?: string }) {
  const d = useApp((s) => s.data);
  const persona = useApp((s) => s.membership.persona);
  const api = useAppApi();
  const [team, setTeam] = useState(initialTeam ?? d.teams[0]?.id ?? '');
  const [name, setName] = useState(initialName ?? d.roster.find((r) => r.team === (initialTeam ?? d.teams[0]?.id))?.name ?? '');
  const [sh, setSh] = useState<SheetState>(emptySheet);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [friendNames, setFriendNames] = useState('');
  const [whereOther, setWhereOther] = useState('');
  const [proofs, setProofs] = useState<Record<string, { name: string; url: string }>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const ctx = valueCtx(api);
  const base = ctx.base;
  const roster = d.roster.filter((r) => r.team === team);
  const badge = useMemo(() => computeBadges(d).find((b) => b.name === name && b.tier), [d, name]);
  const friendCount = sheetFriendCount(sh);
  const given = parseFriendNames(friendNames).length;

  const reset = () => {
    setSh(emptySheet());
    setExpanded(null);
    setFriendNames('');
    setWhereOther('');
    setProofs({});
  };
  const close = () => {
    reset();
    onClose();
  };
  const patch = (p: Partial<SheetState>) => setSh((x) => ({ ...x, ...p }));

  return (
    <Sheet open={open} onClose={close} label="Log a student">
      <div className="flex-none text-[17px] font-medium leading-[1.2] text-neutral-100">Log a student</div>
      {badge ? (
        <div className="flex items-center gap-2 rounded-md px-[11px] py-2" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
          <Icon name="ph-fill ph-medal" className="flex-none text-[15px] text-accent-200" />
          <div className="text-[11.5px] leading-[1.4] text-accent-100">
            {name} — {badge.tier} badge · {badge.attendStreak} wk attendance, {Math.ceil(badge.bibleStreak / 7)} wk Bible
          </div>
        </div>
      ) : null}
      <div className="flex gap-[5.6px]">
        {d.teams.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTeam(t.id);
              setName(d.roster.find((r) => r.team === t.id)?.name ?? '');
            }}
            className="min-h-11 flex-1 rounded-md border text-[11.5px] font-medium leading-none"
            style={sel(team === t.id, t.color)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex-none text-[10.5px] leading-[1.4] text-neutral-500">
        Check-in · {d.roster.filter((r) => d.tonight.presence[r.name]).length} / {d.roster.length} present tonight
      </div>
      <div className="flex h-[150px] flex-none flex-col gap-[5.6px] overflow-auto">
        {roster.map((r) => {
          const here = !!d.tonight.presence[r.name];
          return (
            <div key={r.id} className="flex items-center gap-[7px]">
              <button
                aria-label={r.name + ' is here'}
                aria-pressed={here}
                disabled={!canEditRoster(persona)}
                onClick={() => api().togglePresence(r.name)}
                className="relative flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800"
                style={{ color: here ? 'var(--color-accent-300)' : 'var(--color-neutral-600)' }}
              >
                <Icon name={here ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[15px]" />
              </button>
              <button onClick={() => setName(r.name)} className="flex min-h-11 flex-1 items-center gap-[11px] rounded-md border px-3 text-left" style={sel(name === r.name)}>
                <span className="flex-1 text-[12.5px] font-medium leading-[1.2]" style={{ color: name === r.name ? 'var(--color-accent-100)' : 'var(--color-neutral-200)' }}>
                  {r.name}
                </span>
                {r.guest ? (
                  <span className="rounded-full border border-accent-700 px-[6px] py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[.05em] text-accent-300">{r.newInDb ? 'New guest' : 'Guest'}</span>
                ) : null}
                <span className="text-[10.5px] leading-none text-neutral-500">{(r.captain ? 'captain · ' : '') + 'grade ' + r.grade}</span>
              </button>
            </div>
          );
        })}
        {!roster.length ? <div className="text-[12px] text-neutral-500">{teamOf(d, team).name} has no roster yet.</div> : null}
      </div>
      <div className="h-px bg-divider" />
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">What happened · week {d.config.weekNumber} values</div>
      <div className="flex flex-col gap-[5.6px]">
        {STUDENT_ITEMS.map((it) => {
          const on = !!sh.picks[it.id];
          const val = on ? studentItemValue(it, sh, ctx) : it.mult ? (ctx.baseFor?.(it.cat) ?? base) * it.mult : it.pts ?? 0;
          const isOpen = on && expanded === it.id;
          const count = Math.max(1, sh.counts[it.id] || 1);
          const vc = verseCount(it, sh, ctx);
          return (
            <div key={it.id} className="flex flex-col gap-[5.6px]">
              <button
                onClick={() => {
                  const turningOn = !on;
                  setSh((x) => ({
                    ...x,
                    picks: { ...x.picks, [it.id]: turningOn },
                    articles: it.expand === 'articles' && turningOn ? Math.max(1, x.articles) : x.articles,
                    verses: it.expand === 'verses' && turningOn ? { ...x.verses, [it.id]: Math.max(1, x.verses[it.id] || 1) } : x.verses
                  }));
                  /* A count that stays hidden is a count nobody sets. */
                  if (it.expand) setExpanded(turningOn ? it.id : expanded === it.id ? null : expanded);
                }}
                aria-pressed={on}
                className="flex min-h-11 items-center gap-[11px] rounded-md border px-3 text-left"
                style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent' }}
              >
                <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-accent-100" style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-700)', background: on ? 'var(--color-accent-700)' : 'transparent' }}>
                  {on ? <Icon name="ph-fill ph-check" className="text-[11px]" /> : null}
                </span>
                <span className="flex-1 text-[12.5px] font-medium leading-[1.2]" style={{ color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                  {it.label}
                </span>
                {it.expand ? <Icon name={isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'} className="flex-none text-[11px] text-neutral-500" /> : null}
                <span className="h-[9px] w-[9px] flex-none rounded-sm" style={{ background: catOf(d, it.cat).color }} />
                <span className="tabular min-w-11 text-right text-[11px] font-semibold leading-none text-neutral-400">{fmt(val)}</span>
              </button>

              {isOpen && it.expand === 'friends' ? (
                <Panel>
                  <div className="text-[11px] leading-[1.4] text-neutral-300">{it.friendKind === 'new' ? 'How many were new to the ministry?' : 'How many already in the database?'}</div>
                  <Stepper
                    value={String(count)}
                    onLess={() => patch({ counts: { ...sh.counts, [it.id]: Math.max(1, count - 1) } })}
                    onMore={() => patch({ counts: { ...sh.counts, [it.id]: Math.min(12, count + 1) } })}
                    right={count + ' × ' + fmt((ctx.baseFor?.(it.cat) ?? base) * (it.mult || 1)) + ' = ' + fmt((ctx.baseFor?.(it.cat) ?? base) * (it.mult || 1) * count) + ' pts'}
                  />
                </Panel>
              ) : null}

              {isOpen && it.expand === 'articles' ? (
                <Panel>
                  <div className="text-[11px] leading-[1.4] text-neutral-300">Count the pieces you can see — tap the highest one.</div>
                  <div className="flex flex-col gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => patch({ articles: sh.articles === n ? n - 1 : n })} className="flex min-h-11 items-center gap-[10px] text-left">
                        <Icon name={sh.articles >= n ? 'ph-fill ph-check-square' : 'ph ph-square'} className="flex-none text-[16px]" style={{ color: sh.articles >= n ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }} />
                        <span className="text-[12px] font-medium leading-none" style={{ color: sh.articles >= n ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}>
                          {n === 1 ? '1 article' : n + ' articles'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {sh.articles >= 5 ? (
                    <div className="flex items-center gap-2 border-t border-divider pt-2">
                      <Icon name="ph-fill ph-sparkle" className="flex-none text-[14px] text-accent-300" />
                      <div className="text-[11.5px] font-medium leading-[1.3] text-accent-200 text-pretty">Full ensemble — bonus points and an achievement for this student.</div>
                    </div>
                  ) : null}
                  <div className="tabular text-[11.5px] font-medium leading-[1.3] text-accent-200">
                    {Math.max(1, sh.articles || 1)} × {fmt(it.pts || 0)}
                    {sh.articles >= 5 ? ' + ' + fmt(ENSEMBLE_BONUS) + ' full ensemble' : ''} = {fmt(studentItemValue(it, sh, ctx))} pts
                  </div>
                </Panel>
              ) : null}

              {isOpen && it.expand === 'verses' ? (
                <Panel>
                  <div className="text-[11px] leading-[1.4] text-neutral-300">{it.verseSet === 'sunday' ? 'How many Sunday verses did they recite?' : 'How many of this week’s verses did they recite?'}</div>
                  <Stepper
                    value={String(vc)}
                    onLess={() => patch({ verses: { ...sh.verses, [it.id]: Math.max(1, vc - 1) } })}
                    onMore={() => patch({ verses: { ...sh.verses, [it.id]: Math.min(ctx.verseBoard, vc + 1) } })}
                    right={
                      <span className="flex flex-col items-end gap-[3px]">
                        <span>{vc + ' × ' + fmt(ctx.versePts) + ' = ' + fmt(ctx.versePts * vc) + ' pts'}</span>
                        <span className="text-[10px] font-normal text-neutral-500">of {ctx.verseBoard} on the board this week</span>
                      </span>
                    }
                  />
                  <div className="flex items-center justify-between gap-[10px] border-t border-divider pt-2">
                    <div className="flex-1 text-[10.5px] leading-[1.4] text-neutral-500 text-pretty">Per-verse value is set in Console · Scoring, so a harder week can be worth more.</div>
                    <button onClick={() => patch({ verses: { ...sh.verses, [it.id]: ctx.verseBoard } })} className="min-h-11 flex-none rounded-md border border-accent-700 px-[10px] text-[11px] font-medium leading-none text-accent-200">
                      All of them
                    </button>
                  </div>
                </Panel>
              ) : null}

              {isOpen && it.expand === 'proof' ? (
                <Panel>
                  <div className="text-[11px] leading-[1.4] text-neutral-300 text-pretty">We take their word for it. A photo is optional and pays +{fmt(PROOF_BONUS)} on top.</div>
                  <input
                    ref={(el) => {
                      fileRefs.current[it.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setProofs((p) => ({ ...p, [it.id]: { name: f.name, url: URL.createObjectURL(f) } }));
                      patch({ proof: { ...sh.proof, [it.id]: true } });
                    }}
                  />
                  {!sh.proof[it.id] ? (
                    <button onClick={() => fileRefs.current[it.id]?.click()} className="flex min-h-11 items-center gap-[9px] rounded-md border border-dashed border-accent-600 px-3 text-[12px] font-medium leading-none text-accent-200">
                      <Icon name="ph ph-camera" className="text-[15px]" />
                      Add a photo — optional
                    </button>
                  ) : (
                    <div className="flex items-center gap-[10px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {proofs[it.id] ? <img src={proofs[it.id].url} alt="" className="h-11 w-11 flex-none rounded-md border border-neutral-800 object-cover" /> : null}
                      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <div className="truncate text-[11.5px] font-medium leading-[1.2] text-accent-100">{proofs[it.id]?.name ?? 'Photo'}</div>
                        <div className="text-[10px] leading-[1.2] text-neutral-500">Bonus +{fmt(PROOF_BONUS)} added</div>
                      </div>
                      <button
                        aria-label="Delete"
                        onClick={() => {
                          const next = { ...sh.proof };
                          delete next[it.id];
                          patch({ proof: next });
                        }}
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-500"
                      >
                        <Icon name="ph ph-trash" className="text-[13px]" />
                      </button>
                    </div>
                  )}
                </Panel>
              ) : null}

              {isOpen && it.expand === 'where' ? (
                <Panel>
                  <div className="text-[11px] leading-[1.4] text-neutral-300">Where did they worship?</div>
                  <select value={sh.where} onChange={(e) => patch({ where: e.target.value })} className="input" aria-label="Where did they worship?">
                    <option value="">Not noted</option>
                    {WORSHIP_PLACES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {sh.where === 'Somewhere else' ? <input value={whereOther} onChange={(e) => setWhereOther(e.target.value)} placeholder="Which church or campus?" className="input" /> : null}
                </Panel>
              ) : null}
            </div>
          );
        })}
      </div>
      {STUDENT_ITEMS.some((it) => it.cat === 'visitors' && sh.picks[it.id]) ? (
        <div className="flex flex-col gap-[6px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-accent-300">{friendCount === 1 ? 'Friend’s name — required' : friendCount + ' names required, comma separated'}</div>
          <input value={friendNames} onChange={(e) => setFriendNames(e.target.value)} placeholder="e.g. Ava Collins, Ayla Martin" className="input" aria-label="Friend names" />
          <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">These land in this week’s report so the youth pastor can reach out by name.</div>
          {friendCount > 0 && given < friendCount ? (
            <div className="flex items-center gap-[7px]">
              <Icon name="ph ph-warning-circle" className="flex-none text-[13px] text-accent-300" />
              <div className="text-[10.5px] leading-[1.4] text-accent-200">One name per friend, comma separated — posting is blocked until they are all there.</div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2 pt-[5.6px]">
        <div className="flex-1 text-[11px] leading-[1.4] text-neutral-500">
          {name ? name + ' · ' + teamOf(d, team).name + ' · ' + Object.values(sh.picks).filter(Boolean).length + ' entries' : 'Pick a student'}
        </div>
        <div className="tabular text-[17px] font-semibold leading-none text-accent-200">{fmt(sheetTotal(sh, ctx))}</div>
      </div>
      <div className="flex gap-[8.4px]">
        <Btn variant="ghost" className="min-h-12 flex-1 justify-center" onClick={close}>
          Cancel
        </Btn>
        <Btn
          className="min-h-12 flex-[2] justify-center"
          onClick={() => {
            if (postStudentSheet(api, name, team, sh, friendNames, whereOther)) close();
          }}
        >
          Post entries
        </Btn>
      </div>
    </Sheet>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[9px] rounded-md border border-accent-700 px-3 py-[11px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}>
      {children}
    </div>
  );
}

function Stepper({ value, onLess, onMore, right }: { value: string; onLess: () => void; onMore: () => void; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px]">
      <button aria-label="Fewer" onClick={onLess} className="h-11 w-11 flex-none rounded-md border border-neutral-700 text-[16px] font-medium text-neutral-200">
        −
      </button>
      <div className="tabular min-w-[34px] text-center text-[19px] font-semibold leading-none text-neutral-100">{value}</div>
      <button aria-label="More" onClick={onMore} className="h-11 w-11 flex-none rounded-md border border-accent-600 text-[16px] font-medium text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
        +
      </button>
      <div className="tabular flex-1 text-right text-[11.5px] font-medium leading-[1.3] text-accent-200">{right}</div>
    </div>
  );
}
