'use client';
/* PLANNER · SEASON & NIGHT — one ministry year, cut into seasons; one
   season, cut into nights; one night, in detail: the service order with who
   leads each block, the practices that week, who serves, what goes out, and
   afterwards the debrief with minutes run against minutes planned. */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useCycle } from '@/components/cycle/use-cycle';
import { PageHead, Panel, UndoButtons, usePlanSave } from '@/components/planner/kit';
import { MonthView, SeasonOverview, monthsWithNights } from '@/components/planner/season-views';
import { Btn, Icon, cx } from '@/components/ui';
import { reminders, servePool, whoServes, when } from '@/lib/cycle';
import { holyDaysBetween } from '@/lib/liturgical';
import {
  MONTHS_FROM_AUG, clockOf, laneColor, monthIndex, nextNight, nightsOf, orderOf, orderTimes, seasonsOf, teachingByNight, timings, yearLabel, yearOf, type GatheringPlan, type OrderBlock
} from '@/lib/plan';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';

const SEGS = [
  { id: 'pre', label: 'Before the doors open', adds: ['Setup', 'Leader huddle', 'Rehearsal', 'Prayer'] },
  { id: 'main', label: 'During the gathering', adds: ['Game', 'Worship', 'Teaching', 'Small groups', 'Announcements'] },
  { id: 'post', label: 'After', adds: ['Tear down', 'Leader debrief', 'Follow-up calls'] }
] as const;
const fmtNight = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function SeasonNight() {
  const { d, iso: tonight, today } = useCycle();
  const params = useSearchParams();
  const router = useRouter();
  const p = d.plan;
  const focus = params.get('night') ?? tonight;
  const asked = params.get('view');
  const view = asked === 'season' || asked === 'month' || asked === 'night' ? asked : params.get('night') || params.get('debrief') ? 'night' : 'season';
  const [year, setYear] = useState(() => Math.max(0, Math.min(6, yearOf(p, focus))));
  const seasons = seasonsOf(p, year);
  const [seasonId, setSeasonId] = useState(() => seasons.find((s) => focus >= s.from && focus <= s.to)?.id ?? seasons[0]?.id);
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0];
  const night = season?.nights.includes(focus) ? focus : (season?.nights.find((n) => n >= today) ?? season?.nights[0]);
  const teach = teachingByNight(p, year);
  const holy = p.settings.liturgical && season ? holyDaysBetween(season.from, season.to).filter((h) => h.kind === 'day' && p.holyDays[h.id] !== false) : [];
  const arc = season ? [...new Map(season.nights.filter((n) => teach[n]).map((n) => [teach[n].series.id, teach[n].series])).values()] : [];
  const alongside = season ? p.items.filter((it) => it.year === year && it.lane !== 'teach' && it.month !== undefined && seasonMonths(season.from, season.to).includes(it.month)) : [];
  const pickNight = (n: string) => router.replace('/planner/season?night=' + n);
  const months = monthsWithNights(nightsOf(p, year));
  const [month, setMonth] = useState(() => monthIndex(focus));
  const mo = months.includes(month) ? month : (months.find((x) => x >= monthIndex(today)) ?? months[0]);
  const go = (v: 'season' | 'month' | 'night') => router.replace('/planner/season?view=' + v + (v === 'night' && night ? '&night=' + night : ''));

  return (
    <>
      <PageHead
        kicker={p.settings.name}
        title="Season & night"
        sub="The year cut into seasons, each season into nights. Pick a night to plan it, or to debrief it once it has run."
        right={
          <div className="flex items-center gap-3">
            <UndoButtons />
            <div className="flex items-center gap-1 rounded-full border border-neutral-800 p-1">
              <button aria-label="Previous year" disabled={year === 0} onClick={() => setYear(year - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
                <Icon name="ph ph-caret-left" className="text-[13px]" />
              </button>
              <span className="tabular px-2 text-[13px] text-neutral-100">{yearLabel(p.settings.startYear, year)}</span>
              <button aria-label="Next year" disabled={year === 6} onClick={() => setYear(year + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
                <Icon name="ph ph-caret-right" className="text-[13px]" />
              </button>
            </div>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex rounded-md border border-neutral-800 p-[3px]">
          {(['season', 'month', 'night'] as const).map((v) => (
            <button key={v} onClick={() => go(v)} aria-pressed={view === v} className={cx('min-h-9 rounded-[6px] px-4 text-[13.5px]', view === v ? 'bg-neutral-800 font-medium text-neutral-100' : 'text-neutral-400 hover:text-neutral-200')}>
              {v === 'season' ? 'Season' : v === 'month' ? 'Month' : 'Night'}
            </button>
          ))}
        </div>
        {view === 'month' ? (
          <div className="flex items-center gap-1">
            <button aria-label="Previous month" disabled={months.indexOf(mo) <= 0} onClick={() => setMonth(months[months.indexOf(mo) - 1])} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
              <Icon name="ph ph-caret-left" className="text-[13px]" />
            </button>
            {months.map((x) => (
              <button key={x} onClick={() => setMonth(x)} aria-pressed={x === mo} className={cx('min-h-9 rounded-full px-3 text-[12.5px]', x === mo ? 'border border-accent-500 text-accent-100' : 'text-neutral-400')}>
                {MONTHS_FROM_AUG[x]}
              </button>
            ))}
            <button aria-label="Next month" disabled={months.indexOf(mo) >= months.length - 1} onClick={() => setMonth(months[months.indexOf(mo) + 1])} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 disabled:opacity-30">
              <Icon name="ph ph-caret-right" className="text-[13px]" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeasonId(s.id)}
                aria-pressed={s.id === season?.id}
                className="min-h-10 rounded-full border px-4 text-[12.5px] font-medium"
                style={{ borderColor: s.id === season?.id ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: s.id === season?.id ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
              >
                {s.name} <span className="font-normal text-neutral-500">· {s.nights.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'month' && mo !== undefined ? (
        <MonthView year={year} month={mo} onNight={pickNight} />
      ) : view === 'season' && season ? (
        <SeasonOverview season={season} year={year} alongside={alongside} onNight={pickNight} />
      ) : season ? (
        <div className="grid items-start gap-5 xl:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-5">
            <Panel title={season.name} meta={season.nights.length ? fmtNight(season.nights[0]) + ' – ' + fmtNight(season.nights[season.nights.length - 1]) : 'no nights'}>
              <div className="text-[12.5px] leading-[1.55] text-neutral-400 text-pretty">{season.note}</div>
              <div className="sr-label mt-1">Teaching arc</div>
              {!arc.length ? <div className="text-[12px] text-neutral-500">Nothing scheduled to teach. Add a series on the roadmap.</div> : null}
              {arc.map((s) => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: laneColor(292) }} />
                  <div>
                    <div className="text-[13px] text-neutral-100">
                      {s.title} <span className="text-neutral-500">· {s.size} weeks{s.status === 'draft' ? ' · draft' : ''}</span>
                    </div>
                    {s.bigIdea ? <div className="text-[11.5px] text-neutral-500">{s.bigIdea}</div> : null}
                  </div>
                </div>
              ))}
              {alongside.length ? (
                <>
                  <div className="sr-label mt-1">Alongside the teaching</div>
                  {alongside.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 text-[12.5px] text-neutral-300">
                      <span className="h-2 w-2 rounded-full" style={{ background: laneColor(p.lanes.find((l) => l.id === it.lane)?.hue ?? 0) }} />
                      {it.title}
                    </div>
                  ))}
                </>
              ) : null}
            </Panel>
            <Panel title="Nights" meta={season.nights.length + ' in this season'}>
              <div className="flex flex-col">
                {season.nights.map((n) => {
                  const tt = teach[n];
                  const done = !!p.gatherings[n]?.debrief;
                  const hd = holy.filter((h) => Math.abs(new Date(h.date + 'T12:00:00').getTime() - new Date(n + 'T12:00:00').getTime()) < 4 * 86_400_000);
                  return (
                    <button
                      key={n}
                      onClick={() => pickNight(n)}
                      aria-pressed={n === night}
                      className={cx('flex min-h-11 items-center gap-3 rounded-md px-2 text-left', n === night && 'bg-neutral-900')}
                    >
                      <span className="tabular w-[92px] flex-none text-[12px]" style={{ color: n === tonight ? 'var(--color-accent-200)' : n < today ? 'var(--color-neutral-500)' : 'var(--color-neutral-300)' }}>
                        {fmtNight(n)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-200">{tt ? tt.series.title + ' · ' + tt.week : 'No teaching planned'}</span>
                      {hd.length ? <span className="text-[10.5px] text-accent-300">{hd.map((h) => h.name).join(', ')}</span> : null}
                      {done ? <Icon name="ph-fill ph-check-circle" className="text-[14px] text-accent-300" /> : null}
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
          {night ? <NightDetail key={night} night={night} /> : null}
        </div>
      ) : (
        <div className="text-[13px] text-neutral-500">No seasons are switched on. Turn some on in Settings.</div>
      )}
    </>
  );
}

function seasonMonths(from: string, to: string): number[] {
  const out: number[] = [];
  const m0 = (Number(from.slice(5, 7)) + 4) % 12;
  const m1 = (Number(to.slice(5, 7)) + 4) % 12;
  for (let m = m0; m <= m1; m++) out.push(m);
  return out;
}

function NightDetail({ night }: { night: string }) {
  const { d, m, iso: tonight, today, now } = useCycle();
  const api = useAppApi();
  const params = useSearchParams();
  const save = usePlanSave();
  const p = d.plan;
  const g: GatheringPlan = p.gatherings[night] ?? {};
  const order = orderOf(p, night);
  const timed = orderTimes(order, d.config.cycle.setupAt);
  const tt = teachingByNight(p, yearOf(p, night))[night];
  const pool = [...new Set([...servePool(d), m.displayName])];
  const past = night < today || (night === today && now > new Date(night + 'T' + d.config.cycle.endAt).getTime());
  const [debriefOpen, setDebriefOpen] = useState(params.get('debrief') === '1' && night === tonight);
  const [answers, setAnswers] = useState<Record<string, string>>(g.debrief?.answers ?? {});
  const [actual, setActual] = useState<Record<string, string>>(Object.fromEntries(Object.entries(g.debrief?.actual ?? {}).map(([k, v]) => [k, String(v)])));
  const tm = timings(p, night);
  const next = nextNight(p, night, today);

  const setOrder = (fn: (o: OrderBlock[]) => OrderBlock[], label: string, merge?: string) =>
    save((x) => {
      const cur = x.gatherings[night]?.order ?? orderOf(x, night).map((b) => ({ ...b }));
      x.gatherings[night] = { ...x.gatherings[night], order: fn(cur) };
    }, label, merge ? { merge } : undefined);
  const patch = (id: string, pt: Partial<OrderBlock>, merge?: string) => setOrder((o) => o.map((b) => (b.id === id ? { ...b, ...pt } : b)), 'Edit the order of ' + fmtNight(night), merge);
  const move = (id: string, dir: -1 | 1) =>
    setOrder((o) => {
      const i = o.findIndex((b) => b.id === id);
      const j = i + dir;
      if (j < 0 || j >= o.length || o[j].seg !== o[i].seg) return o;
      const c = [...o];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    }, 'Reorder ' + fmtNight(night));
  const useTonight = () => {
    const sheet = timed.filter((b) => b.seg !== 'post' || /debrief/i.test(b.kind)).map((b) => ({
      id: uid(),
      time: clockOf(b.start),
      label: b.kind + (b.title ? ' · ' + b.title : ''),
      where: '',
      who: b.lead ?? 'Everyone serving',
      detail: '',
      assignedTo: d.huddle.crew.find((c) => c.name === b.lead)?.id ?? null,
      notifiedAt: null,
      ...(/debrief/i.test(b.kind) ? { debrief: true } : {})
    }));
    if (!window.confirm('Replace tonight’s run sheet with this order? Owners will need to be told again.')) return;
    api().mutate((x) => {
      x.huddle.runSheet = sheet;
      x.huddle.runIdx = 0;
      x.huddle.runDone = {};
      x.huddle.sheetDirty = true;
    });
    api().emit({ kind: 'huddle', huddle: api().data.huddle });
    api().say('Tonight’s run sheet now follows this order. Publish it from the huddle sheet.');
  };
  const saveDebrief = () => {
    const nums = Object.fromEntries(Object.entries(actual).filter(([, v]) => v.trim() !== '' && !isNaN(Number(v))).map(([k, v]) => [k, Math.max(0, Math.round(Number(v)))]));
    save((x) => {
      x.gatherings[night] = { ...x.gatherings[night], debrief: { ...x.gatherings[night]?.debrief, answers, actual: nums, at: Date.now(), by: m.displayName } };
    }, 'Debrief ' + fmtNight(night));
    api().logActivity('Debriefed ' + fmtNight(night) + ' · ' + m.displayName);
    setDebriefOpen(false);
    api().say('Debrief saved.');
  };
  const carry = () => {
    if (!next) return;
    save((x) => {
      const src = x.gatherings[night]?.debrief?.actual ?? {};
      const target = x.gatherings[next]?.order ?? orderOf(x, next).map((b) => ({ ...b }));
      x.gatherings[next] = { ...x.gatherings[next], order: target.map((b) => (src[b.id] != null ? { ...b, mins: src[b.id] } : b)) };
      if (x.gatherings[night]?.debrief) x.gatherings[night]!.debrief!.carriedTo = next;
      const nd = x.gatherings[next]!;
      nd.brief = (nd.brief ? nd.brief + '\n' : '') + 'Timings carried from ' + fmtNight(night) + '.';
    }, 'Carry timings to ' + fmtNight(next));
    api().say('Carried to ' + fmtNight(next) + '. Undo if you didn’t mean it.');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[.12em] text-neutral-500">{night === tonight ? 'Tonight' : past ? 'Has run' : 'Ahead'}</div>
          <div className="mt-1 text-[22px] font-medium leading-[1.2] text-neutral-100">{new Date(night + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="mt-1 text-[12.5px] text-neutral-400">{tt ? tt.series.title + ' · week ' + tt.week + ' of ' + tt.of + (tt.series.bigIdea ? ' · ' + tt.series.bigIdea : '') : 'No teaching planned for this night'}</div>
        </div>
        {night === tonight ? (
          <Btn variant="secondary" className="px-3 text-[12px]" onClick={useTonight}>
            Use as tonight’s run sheet
          </Btn>
        ) : null}
        <Btn className="px-3 text-[12px]" onClick={() => setDebriefOpen(!debriefOpen)}>
          {g.debrief ? 'Edit the debrief' : 'Debrief this night'}
        </Btn>
      </div>

      {debriefOpen ? (
        <Panel title="Debrief" meta={g.debrief ? 'saved ' + when(g.debrief.at) + ' by ' + g.debrief.by : 'while it’s fresh'}>
          <div className="grid gap-3 md:grid-cols-2">
            {p.debriefQs
              .filter((q) => q.on)
              .map((q) => (
                <label key={q.id} className="flex flex-col gap-1">
                  <span className="text-[12.5px] text-neutral-200">{q.q}</span>
                  {q.note ? <span className="text-[11px] text-neutral-500">{q.note}</span> : null}
                  <textarea className="input min-h-[80px] py-2 text-[12.5px]" value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                </label>
              ))}
          </div>
          <div className="sr-label mt-1">Minutes on the night</div>
          <table className="w-full max-w-[560px] text-[12.5px]">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1 font-medium">Block</th>
                <th className="py-1 font-medium">Planned</th>
                <th className="py-1 font-medium">Actual</th>
                <th className="py-1 font-medium">Off by</th>
              </tr>
            </thead>
            <tbody>
              {order
                .filter((b) => b.seg === 'main')
                .map((b) => {
                  const a = actual[b.id];
                  const off = a !== undefined && a !== '' && !isNaN(Number(a)) ? Number(a) - b.mins : null;
                  return (
                    <tr key={b.id} className="border-t border-divider">
                      <td className="py-[6px] text-neutral-200">{b.title || b.kind}</td>
                      <td className="tabular py-[6px] text-neutral-400">{b.mins}</td>
                      <td className="py-[6px]">
                        <input className="input !min-h-8 !w-[80px] !py-0" type="number" min={0} value={a ?? ''} onChange={(e) => setActual({ ...actual, [b.id]: e.target.value })} aria-label={'Actual minutes for ' + (b.title || b.kind)} />
                      </td>
                      <td className="tabular py-[6px]" style={{ color: off ? (off > 0 ? 'var(--color-accent-200)' : 'var(--color-neutral-300)') : 'var(--color-neutral-500)' }}>
                        {off == null ? '—' : (off > 0 ? '+' : '') + off}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <div className="text-[11px] text-neutral-500">Leave a block blank if it ran to plan. Only blocks you fill in are recorded.</div>
          <div className="flex gap-2">
            <Btn className="px-4" onClick={saveDebrief}>
              Save debrief
            </Btn>
            <Btn variant="ghost" className="px-3" onClick={() => setDebriefOpen(false)}>
              Cancel
            </Btn>
          </div>
        </Panel>
      ) : null}

      {tm.recorded ? (
        <Panel title="Planned against actual" meta={(tm.net > 0 ? '+' : '') + tm.net + ' min net'}>
          <div className="flex flex-wrap gap-2">
            {tm.rows
              .filter((r) => r.actual != null)
              .map((r) => (
                <span key={r.id} className="rounded-full border border-neutral-800 px-3 py-[5px] text-[12px] text-neutral-300">
                  {r.label} {r.planned}→{r.actual} <span style={{ color: r.off > 0 ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}>({r.off > 0 ? '+' : ''}{r.off})</span>
                </span>
              ))}
          </div>
          {g.debrief?.carriedTo ? (
            <div className="text-[11.5px] text-neutral-500">Carried to {fmtNight(g.debrief.carriedTo)}.</div>
          ) : next ? (
            <Btn variant="secondary" className="self-start px-3 text-[12px]" onClick={carry}>
              Carry these timings to {fmtNight(next)}
            </Btn>
          ) : null}
        </Panel>
      ) : null}

      {g.live?.acts.length ? (
        <Panel
          title="Live ministry time"
          meta={g.live.results ? 'attached ' + when(g.live.results.at) + ' by ' + g.live.results.by : g.live.acts.length + ' activities planned'}
          right={
            <Link href={'/planner/live?night=' + night + (g.live.results ? '&tab=results' : '')} className="text-[12px] text-accent-300">
              {g.live.results ? 'Results' : 'Set up'}
            </Link>
          }
        >
          {g.live.results ? (
            <div className="flex flex-col gap-2">
              {g.live.results.lines.map((l) => (
                <div key={l.id} className="text-[12.5px] leading-[1.5]">
                  <span className="text-neutral-100">{l.prompt}</span>
                  <span className="text-neutral-500"> — {l.line}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12.5px] text-neutral-400">{g.live.acts.map((a) => a.prompt).join(' · ')}</div>
          )}
        </Panel>
      ) : null}

      <div className="grid items-start gap-5 2xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Service order" meta={'from ' + clockOf(timed[0]?.start ?? 0) + ' · ' + order.reduce((n, b) => n + b.mins, 0) + ' min'}>
          {SEGS.map((sg) => (
            <div key={sg.id} className="flex flex-col gap-[6px]">
              <div className="sr-label">{sg.label}</div>
              {timed
                .filter((b) => b.seg === sg.id)
                .map((b) => (
                  <div key={b.id} className="grid items-center gap-2 md:grid-cols-[60px_130px_1fr_70px_150px_auto]">
                    <span className="tabular text-[12px] text-neutral-500">{clockOf(b.start)}</span>
                    <input className="input !min-h-9 !py-0" value={b.kind} onChange={(e) => patch(b.id, { kind: e.target.value }, 'kind:' + b.id)} aria-label="Block" />
                    <input className="input !min-h-9 !py-0" value={b.title} placeholder="What it is tonight" onChange={(e) => patch(b.id, { title: e.target.value }, 'title:' + b.id)} aria-label="What it is" />
                    <input className="input !min-h-9 !py-0" type="number" min={0} value={b.mins} onChange={(e) => patch(b.id, { mins: Math.max(0, Number(e.target.value) || 0) }, 'mins:' + b.id)} aria-label="Minutes" />
                    <select className="input !min-h-9 !py-0" value={b.lead ?? ''} onChange={(e) => patch(b.id, { lead: e.target.value || null })} aria-label="Who leads">
                      <option value="">Everyone</option>
                      {pool.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <div className="flex">
                      <button aria-label="Move up" onClick={() => move(b.id, -1)} className="h-9 w-8 text-neutral-400">
                        <Icon name="ph ph-arrow-up" className="text-[12px]" />
                      </button>
                      <button aria-label="Move down" onClick={() => move(b.id, 1)} className="h-9 w-8 text-neutral-400">
                        <Icon name="ph ph-arrow-down" className="text-[12px]" />
                      </button>
                      <button aria-label="Remove" onClick={() => setOrder((o) => o.filter((x) => x.id !== b.id), 'Remove ' + b.kind)} className="h-9 w-8 text-neutral-500">
                        <Icon name="ph ph-x" className="text-[12px]" />
                      </button>
                    </div>
                  </div>
                ))}
              <div className="flex flex-wrap gap-[6px]">
                {sg.adds.map((a) => (
                  <button key={a} onClick={() => setOrder((o) => insertInSeg(o, { id: uid(), seg: sg.id, kind: a, title: '', mins: 10, lead: null }), 'Add ' + a)} className="min-h-8 rounded-full border border-neutral-800 px-3 text-[11.5px] text-neutral-400">
                    + {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title="Practices this week" right={<button onClick={() => save((x) => void (x.gatherings[night] = { ...x.gatherings[night], practices: [...(x.gatherings[night]?.practices ?? []), { id: uid(), name: 'Band rehearsal', day: -1, start: '19:00', mins: 60, people: [] }] }), 'Add a practice')} className="text-[12px] text-accent-300">+ Practice</button>}>
            {!(g.practices ?? []).length ? <div className="text-[12px] text-neutral-500">Nothing outside the night itself.</div> : null}
            {(g.practices ?? []).map((pr) => {
              const setPr = (pt: Partial<typeof pr>, merge?: string) => save((x) => void (x.gatherings[night]!.practices = x.gatherings[night]!.practices!.map((y) => (y.id === pr.id ? { ...y, ...pt } : y))), 'Edit a practice', merge ? { merge } : undefined);
              return (
                <div key={pr.id} className="grid items-center gap-2 border-t border-divider pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_110px_90px_60px_auto]">
                  <input className="input !min-h-9 !py-0" value={pr.name} onChange={(e) => setPr({ name: e.target.value }, 'pr-name:' + pr.id)} aria-label="Practice" />
                  <select className="input !min-h-9 !py-0" value={pr.day} onChange={(e) => setPr({ day: Number(e.target.value) })} aria-label="Day">
                    {[-3, -2, -1, 0].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Same day' : n === -1 ? 'Day before' : n + ' days'}
                      </option>
                    ))}
                  </select>
                  <input className="input !min-h-9 !py-0" type="time" value={pr.start} onChange={(e) => setPr({ start: e.target.value }, 'pr-start:' + pr.id)} aria-label="Starts" />
                  <input className="input !min-h-9 !py-0" type="number" value={pr.mins} onChange={(e) => setPr({ mins: Math.max(5, Number(e.target.value) || 30) }, 'pr-mins:' + pr.id)} aria-label="Minutes" />
                  <button aria-label="Remove practice" onClick={() => save((x) => void (x.gatherings[night]!.practices = x.gatherings[night]!.practices!.filter((y) => y.id !== pr.id)), 'Remove a practice')} className="h-9 w-8 text-neutral-500">
                    <Icon name="ph ph-x" className="text-[12px]" />
                  </button>
                  <div className="text-[11px] text-neutral-500 sm:col-span-5">Called: {pr.people.join(', ') || 'nobody yet'}</div>
                </div>
              );
            })}
          </Panel>
          <Panel title="Volunteers" right={<a href="/planner/people" className="text-[12px] text-accent-300">Schedule</a>}>
            {d.config.cycle.serveRoles.map((r) => (
              <div key={r} className="flex gap-3 text-[12.5px]">
                <span className="w-[110px] text-neutral-500">{r}</span>
                <span style={{ color: whoServes(d, night, r) ? 'var(--color-neutral-100)' : 'var(--color-accent-300)' }}>{whoServes(d, night, r) ?? 'Open'}</span>
              </div>
            ))}
          </Panel>
          <Panel title="Going out">
            {reminders(d, night, now).map((r) => (
              <div key={r.id} className="flex flex-col border-t border-divider pt-2 first:border-t-0 first:pt-0">
                <div className="flex gap-2 text-[12.5px]">
                  <span className="flex-1 text-neutral-100">{r.label}</span>
                  <span className="text-[11px]" style={{ color: r.sent ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[11.5px] leading-[1.45] text-neutral-500">{r.text}</div>
              </div>
            ))}
          </Panel>
          {g.brief ? (
            <Panel title="Leader brief">
              <div className="whitespace-pre-line text-[12.5px] leading-[1.55] text-neutral-300">{g.brief}</div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function insertInSeg(o: OrderBlock[], b: OrderBlock): OrderBlock[] {
  const last = o.map((x) => x.seg).lastIndexOf(b.seg);
  const at = last >= 0 ? last + 1 : b.seg === 'pre' ? 0 : b.seg === 'post' ? o.length : o.findIndex((x) => x.seg === 'post') >= 0 ? o.findIndex((x) => x.seg === 'post') : o.length;
  return [...o.slice(0, at), b, ...o.slice(at)];
}
