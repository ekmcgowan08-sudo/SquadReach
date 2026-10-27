'use client';
/* TOURNAMENT BRACKET — single elimination, seeded from the standings to
   start. Shuffle it, place squads in round one by hand, or tap a name to
   send the winner of a match on; a filmed bracket game settles itself
   (components/media/recorder). Each win pays the night's base points to
   Games once; a corrected result takes the old win back. */
import { Btn, Icon, cx } from '@/components/ui';
import { advanceBracket, bracketChampion, bracketSeeds, buildBracket, placeSeed, type BracketMatch } from '@/lib/feeds';
import { bracketOf } from '@/lib/game';
import { fmt, pointBase } from '@/lib/scoring';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { BracketData } from '@/lib/types/model';

export const roundLabel = (i: number, n: number) => (n - i === 1 ? 'Final' : n - i === 2 ? 'Semifinal' : 'Round ' + (i + 1));

export function Bracket({ editable }: { editable: boolean }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const b = bracketOf(d.game);
  const seeds = bracketSeeds(d.teams, d.ledger, b);
  const rounds = buildBracket(seeds, b.winners);
  const champ = bracketChampion(rounds);
  const base = pointBase(d.config, 'games');
  const name = (id: string | null) => d.teams.find((t) => t.id === id)?.name ?? '';
  const color = (id: string | null) => d.teams.find((t) => t.id === id)?.color ?? 'var(--color-neutral-700)';

  const save = (next: BracketData, note?: string) => {
    api().mutate((x) => void (x.game.bracket = next));
    api().emit({ kind: 'game', game: api().data.game });
    if (note) api().logActivity(note);
  };
  const pay = (team: string, sign: 1 | -1) => api().award({ team, cat: 'games', amount: sign * base, why: sign > 0 ? 'won a bracket game' : 'bracket result corrected', by: 'Tournament' });
  const advance = (m: BracketMatch, team: string) => {
    const r = advanceBracket(b, seeds, m.key, team);
    if (r.next === b) return;
    for (const t of r.unpay) pay(t, -1);
    for (const t of r.pay) pay(t, 1);
    save(r.next, 'Bracket: ' + name(team) + ' wins ' + roundLabel(m.round, rounds.length).toLowerCase());
    api().say(name(team) + ' advances' + (r.pay.length ? ' · +' + fmt(base) + ' Games' : '') + '.');
  };
  const clearResults = (next: Partial<BracketData>, note: string) => {
    for (const t of Object.values(b.paid)) pay(t, -1);
    save({ ...b, winners: {}, paid: {}, ...next }, note);
  };
  const confirmReset = () => !Object.keys(b.paid).length || window.confirm('Start the results over? Points paid for bracket wins are taken back.');

  return (
    <section aria-label="Tournament bracket" className="sr-card flex flex-col gap-3 px-[14px] py-[13px]">
      <div className="flex items-center gap-2">
        <Icon name="ph ph-tree-structure" className="text-[16px] text-accent-300" />
        <div className="flex-1 text-[13.5px] font-medium text-neutral-100">Tournament bracket</div>
        {editable ? (
          <button
            onClick={() => save({ ...b, enabled: !b.enabled, seeds: b.seeds.length === d.teams.length ? b.seeds : seeds }, b.enabled ? 'Turned off tournament mode' : 'Turned on tournament mode')}
            aria-pressed={b.enabled}
            className={cx('min-h-11 rounded-full border px-3 text-[12px] font-medium', b.enabled ? 'border-accent-500 text-accent-100' : 'border-neutral-700 text-neutral-400')}
          >
            {b.enabled ? 'Tournament mode on' : 'Turn on tournament mode'}
          </button>
        ) : null}
      </div>
      {b.enabled ? (
        <>
          <p className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">
            Single elimination, seeded from the standings to start. {editable ? 'Place squads in round one with the dropdowns, or tap a name to send the winner on. ' : ''}Each win pays {fmt(base)} to Games.
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => confirmReset() && clearResults({ liveSeed: !b.liveSeed, seeds }, b.liveSeed ? 'Live seeding off' : 'Live seeding on')}>
                {b.liveSeed && !Object.keys(b.winners).length ? 'Live seeding on' : 'Live seeding off'}
              </Btn>
              <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => confirmReset() && clearResults({ seeds: bracketSeeds(d.teams, d.ledger, { ...b, liveSeed: true, winners: {} }) }, 'Re-seeded the bracket from the standings')}>
                Seed from standings
              </Btn>
              <Btn
                variant="secondary"
                className="px-3 text-[12px]"
                onClick={() => {
                  if (!confirmReset()) return;
                  const ids = d.teams.map((t) => t.id);
                  for (let i = ids.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                  }
                  clearResults({ seeds: ids, liveSeed: false }, 'Shuffled the bracket seeds');
                }}
              >
                Shuffle seeds
              </Btn>
              <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => confirmReset() && clearResults({ seeds, liveSeed: false }, 'Reset the bracket results')}>
                Reset results
              </Btn>
            </div>
          ) : null}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {rounds.map((rd, i) => (
              <div key={i} className="flex min-w-[170px] flex-1 flex-col gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">{roundLabel(i, rounds.length)}</div>
                <div className="flex flex-1 flex-col justify-around gap-3">
                {rd.map((m, k) => (
                  <div key={m.key} className="flex flex-col gap-1 rounded-md bg-neutral-900 p-2" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
                    {(['a', 'b'] as const).map((side) => {
                      const id = m[side];
                      const won = !!id && m.winner === id;
                      const lost = !!m.winner && !!id && m.winner !== id;
                      return (
                        <button
                          key={side}
                          disabled={!editable || !id || !m.a || !m.b}
                          onClick={() => id && advance(m, id)}
                          aria-label={id ? (editable ? name(id) + ' wins ' + roundLabel(i, rounds.length).toLowerCase() + ' match ' + (k + 1) : name(id)) : 'Bye'}
                          aria-pressed={won}
                          className={cx('flex min-h-11 items-center gap-2 rounded px-2 text-left text-[12.5px]', won ? 'text-neutral-100' : lost ? 'text-neutral-500 line-through' : 'text-neutral-300')}
                          style={{ background: won ? 'color-mix(in srgb, ' + color(id) + ' 22%, transparent)' : 'transparent' }}
                        >
                          <span className="h-2 w-2 flex-none rounded-full" style={{ background: id ? color(id) : 'transparent' }} />
                          <span className="flex-1 truncate">{id ? name(id) : i === 0 ? 'Bye' : 'Waiting'}</span>
                          {won ? <Icon name="ph ph-check" className="text-[12px] text-accent-200" /> : null}
                        </button>
                      );
                    })}
                    {editable && i === 0 ? (
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        {[0, 1].map((slot) => {
                          const idx = k * 2 + slot;
                          return seeds[idx] ? (
                            <select key={slot} aria-label={'Round one slot ' + (idx + 1)} className="input !min-h-9 !px-2 !py-0 text-[11.5px]" value={seeds[idx]} onChange={(e) => confirmReset() && clearResults({ seeds: placeSeed(seeds, idx, e.target.value), liveSeed: false }, 'Placed ' + name(e.target.value) + ' in bracket slot ' + (idx + 1))}>
                              {d.teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          ) : null;
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
                </div>
              </div>
            ))}
          </div>
          {champ ? (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px] font-medium text-neutral-100" style={{ background: 'color-mix(in srgb, ' + color(champ) + ' 20%, transparent)' }}>
              <Icon name="ph-fill ph-trophy" className="text-[16px]" style={{ color: color(champ) }} />
              {name(champ)} wins the tournament
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
