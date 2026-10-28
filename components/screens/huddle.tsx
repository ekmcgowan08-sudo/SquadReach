'use client';
/* THE 6:15 HUDDLE — the spine every other beat of the night hangs off.
   In the order it is read: Now · the debrief (from 8:50) · your post · run
   of show · serving tonight · uncovered posts + the bench · the one thing ·
   pray for this before you go out.

   The sheet does not advance itself. advance/jump are the only things that
   move runIdx; the pace line is measured from when the holder last tapped,
   because the sheet is a plan and the night is not. runIdx is shared state
   for the whole building — every change is written to the night's row and
   other phones follow over realtime. */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { longDate, nowMs } from '@/lib/dates';
import { uncoveredPosts } from '@/lib/feeds';
import { canApprove, canEditRoster, holdsSheet } from '@/lib/permissions';
import { openFollowups, runMinutes, teamOf } from '@/lib/selectors';
import { sendNightReports } from '@/lib/store/actions';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { CrewMember, CrewState, HuddleState } from '@/lib/types/model';

const STM: Record<CrewState, { icon: string; fg: string; word: string }> = {
  here: { icon: 'ph-fill ph-check-circle', fg: 'var(--color-accent-300)', word: 'Here' },
  late: { icon: 'ph ph-clock-countdown', fg: 'var(--color-neutral-400)', word: 'Running late' },
  out: { icon: 'ph ph-x-circle', fg: 'var(--color-out)', word: 'Not coming' }
};
const BLANK = { icon: 'ph ph-circle', fg: 'var(--color-neutral-600)', word: 'Not marked' };

export function useHuddleSave() {
  const api = useAppApi();
  return (recipe: (h: HuddleState) => void) => {
    api().mutate((d) => recipe(d.huddle));
    api().emit({ kind: 'huddle', huddle: api().data.huddle });
  };
}

/** Everyone serving: the scheduled crew plus whoever came off the bench. */
export function crewAll(h: HuddleState): CrewMember[] {
  const postLabel = (key: string) => {
    if (key.startsWith('crew:')) return h.crew.find((c) => 'crew:' + c.id === key)?.post ?? 'a post';
    return h.openPosts.find((p) => p.id === key)?.post ?? 'a post';
  };
  const subs = Object.entries(h.covered).map(([key, bid]) => {
    const b = h.bench.find((x) => x.id === bid);
    return { id: 'sub_' + bid, name: b?.name ?? 'Volunteer', job: 'Covering', post: postLabel(key), team: null, sendHome: 'With the post' };
  });
  return [...h.crew, ...subs];
}

export function HuddleScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const outbox = useApp((s) => s.outbox.length);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const router = useRouter();
  const save = useHuddleSave();
  const [now, setNow] = useState(() => nowMs());
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openCrew, setOpenCrew] = useState<string | null>(null);
  const [benchFor, setBenchFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [flagName, setFlagName] = useState('');
  const [debriefNote, setDebriefNote] = useState('');
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), 20_000);
    return () => clearInterval(t);
  }, []);

  const h = d.huddle;
  const sheet = h.runSheet;
  const idx = Math.max(0, Math.min(sheet.length - 1, h.runIdx));
  const cur = sheet[idx];
  const nxt = sheet[idx + 1] ?? null;
  const holds = holdsSheet(m.persona);
  const planned = sheet.length ? runMinutes(sheet, idx) : 0;
  const mins = Math.max(0, Math.floor((now - h.runAdvancedAt) / 60000));
  const over = mins - planned;
  const crew = useMemo(() => crewAll(h), [h]);
  const st = (id: string) => h.crewState[id] ?? null;
  const nHere = crew.filter((c) => st(c.id) === 'here').length;
  const nLate = crew.filter((c) => st(c.id) === 'late').length;
  const nOut = crew.filter((c) => st(c.id) === 'out').length;
  const nBlank = crew.filter((c) => !st(c.id)).length;
  const holder = h.crew.find((c) => /pastor/i.test(c.job))?.name.split(' ')[0];
  const holderLabel = holder ? 'Pastor ' + holder : 'The youth pastor';

  const mine = useMemo(() => {
    const byName = crew.find((c) => c.name === m.displayName || ('Pastor ' + c.name.split(' ')[0]) === m.displayName || ('Coach ' + c.name.split(' ')[0]) === m.displayName);
    if (byName) return byName;
    if (m.role === 'leader') return crew.find((c) => /pastor/i.test(c.job)) ?? null;
    if (m.role === 'owner') return crew.find((c) => /admin/i.test(c.job)) ?? null;
    if (m.role === 'scorekeeper') return crew.find((c) => /scorekeeper/i.test(c.job)) ?? null;
    if (m.role === 'coach') return crew.find((c) => c.team === (m.teamId ?? coachTeam) && c.job.startsWith('Coach')) ?? null;
    return null;
  }, [crew, m, coachTeam]);

  const uncovered = useMemo(() => uncoveredPosts(h), [h]);
  const serving = new Set(Object.values(h.covered));
  const bench = h.bench.filter((b) => !serving.has(b.id));
  const postedTeams = Object.keys(d.tonight.checkinPosted);
  const flagged = new Set(openFollowups(d).map((r) => r.name));
  const missing = postedTeams
    .flatMap((t) => d.roster.filter((r) => r.team === t && !d.tonight.presence[r.name]).map((r) => r.name))
    .filter((n) => !flagged.has(n))
    .slice(0, 8);
  const topPrayer = d.prayers.filter((p) => !p.answered).sort((a, b) => b.praying - a.praying)[0];
  const meetingDate = d.config.meetingDates[d.config.weekNumber - 1] ?? d.tonight.date;

  const move = (to: number) => {
    if (!holds) {
      api().say(holderLabel + ' is running the sheet tonight.');
      return;
    }
    const next = Math.max(0, Math.min(sheet.length - 1, to));
    if (next === h.runIdx) return;
    save((x) => {
      x.runDone = {};
      x.runSheet.forEach((it, i) => {
        if (i < next) x.runDone[it.id] = true;
      });
      x.runIdx = next;
      x.runAdvancedAt = nowMs();
    });
    setNow(nowMs());
    setOpenItem(null);
    api().logActivity('Run sheet moved to ' + sheet[next].time + ' ' + sheet[next].label);
    api().say(sheet[next].time + ' · ' + sheet[next].label + '. Everyone serving sees it.');
  };

  const setCrew = (id: string, state: CrewState | null) => {
    const p = crew.find((c) => c.id === id);
    save((x) => {
      if (state) x.crewState[id] = state;
      else delete x.crewState[id];
    });
    setOpenCrew(null);
    /* Volunteer attendance is a season record — every mark writes the log. */
    if (state) api().logActivity((p?.name ?? 'Volunteer') + ' marked ' + (state === 'here' ? 'here' : state === 'late' ? 'running late' : 'not coming') + ' tonight');
  };

  /* Asks are keyed by POST, not by person: the same volunteer can be asked
     about the north door after turning down the gym floor. */
  const ask = (bid: string) => {
    if (!benchFor) return;
    if (offline) {
      api().say('No signal — asking the bench needs a connection.');
      return;
    }
    const b = h.bench.find((x) => x.id === bid);
    const post = uncovered.find((u) => u.id === benchFor)?.post ?? 'a post';
    save((x) => {
      x.subAsks[benchFor] = [...(x.subAsks[benchFor] ?? []), bid];
    });
    api().logActivity('Asked ' + (b?.name ?? 'a volunteer') + ' to cover ' + post);
    api().notify('Can you cover ' + post + ' tonight?', 'Tell the leader yes or no.', '/dashboard/huddle');
    api().say('Asked. If ' + (b?.name.split(' ')[0] ?? 'they') + ' is in SquadRise, it’s in their notifications (and pushed, if push is on for their phone) — confirm here once they say yes.');
  };
  const confirm = (bid: string) => {
    if (!benchFor) return;
    const b = h.bench.find((x) => x.id === bid);
    /* The handler re-checks what the list already filtered. One body, one post. */
    if (Object.values(h.covered).includes(bid)) {
      api().say((b?.name.split(' ')[0] ?? 'They') + ' is already covering a post tonight.');
      return;
    }
    const post = uncovered.find((u) => u.id === benchFor)?.post ?? 'a post';
    const key = benchFor;
    save((x) => {
      x.covered[key] = bid;
      x.crewState['sub_' + bid] = 'here';
      x.subAsks[key] = (x.subAsks[key] ?? []).filter((y) => y !== bid);
    });
    setBenchFor(null);
    api().logActivity((b?.name ?? 'A volunteer') + ' covering ' + post + ' tonight');
    api().say(post + ' is covered — ' + (b?.name ?? '') + '.');
  };

  /* DEBRIEF FEEDS: a flagged name lands on Team care; a note lands on next week. */
  const flagCare = (name: string) => {
    const n = name.trim();
    if (!n) {
      api().say('Type a name first.');
      return;
    }
    if (openFollowups(d).some((r) => r.name === n)) {
      api().say(n.split(' ')[0] + ' is already on the care list.');
      return;
    }
    const item = { id: uid(), initials: n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), name: n, meta: 'Flagged at debrief · ' + m.displayName + ' · tonight', flaggedBy: m.displayName, at: nowMs() };
    api().mutate((x) => {
      x.careReminders.push(item);
    });
    api().emit({ kind: 'careAdd', item });
    api().logActivity('Flagged ' + n + ' for follow-up at debrief');
    setFlagName('');
    api().say(n.split(' ')[0] + ' is on the care list — Follow-ups › Team care.');
  };
  const fileNote = () => {
    const v = debriefNote.trim();
    if (!v) {
      api().say('Write the one thing to change first.');
      return;
    }
    const wk = d.config.weekNumber + 1;
    save((x) => {
      x.debriefNotes.push({ id: uid(), text: v, week: wk, at: nowMs() });
    });
    setDebriefNote('');
    api().logActivity('Debrief note filed on Week ' + wk + ': ' + v);
    api().say('Filed on Week ' + wk + '.');
  };
  const endNight = () => {
    if (outbox) {
      api().say(outbox + (outbox === 1 ? ' item is' : ' items are') + ' still held. Stay on wifi a moment — they send themselves.');
      return;
    }
    save((x) => {
      x.nightClosed = true;
      x.closedAt = nowMs();
    });
    const sent = sendNightReports(api);
    api().logActivity('Night closed at debrief' + (sent ? ' · ' + sent + (sent === 1 ? ' report' : ' reports') + ' to leaders' : ''));
    api().say(
      sent
        ? 'Night closed. ' + sent + (sent === 1 ? ' report is' : ' reports are') + ' on the way to leaders now; families see tonight on their link.'
        : 'Night closed. No report is set to go out when a night closes — add one in Console › Reports.'
    );
  };

  const clock = new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '').replace('m', '');

  return (
    <Screen label="Huddle" gap={13}>
      <ScreenHeader title="Huddle" sub={(meetingDate ? longDate(meetingDate).replace(/^(\w+), (\w+) (\d+)$/, '$1, $2 $3') : 'Tonight') + ' · Week ' + d.config.weekNumber} right={<div className="tabular flex-none text-[14px] font-semibold leading-none text-neutral-300">{clock}</div>} />

      {!sheet.length ? (
        <div className="rounded-lg border border-dashed border-neutral-700 px-[15px] py-[18px]">
          <div className="text-[14px] font-medium leading-[1.25] text-neutral-200">No run of show tonight</div>
          <div className="mt-[5px] text-[11.5px] leading-[1.55] text-neutral-500 text-pretty">Nothing on tonight’s sheet yet. Build it in Console · Huddle Sheet, or load one of the nights you have already saved.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-[11px] rounded-lg border border-accent-700 p-[14px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 9%, transparent)' }}>
          <div className="flex items-baseline gap-[9px]">
            <span className="text-[10px] font-semibold uppercase leading-none tracking-[.13em] text-accent-300">Now</span>
            <span className="tabular text-[13px] font-semibold leading-none text-accent-200">{cur.time}</span>
            <span className="flex-1" />
            <span className="tabular text-[10.5px] leading-none text-neutral-500">
              Planned {planned} min · {mins ? mins + ' min in' : 'just started'}
            </span>
          </div>
          <div>
            <div className="text-[19px] font-medium leading-[1.15] text-neutral-100">{cur.label}</div>
            <div className="mt-[5px] text-[11.5px] leading-[1.3] text-neutral-400">{[cur.where, cur.who].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="text-[12px] leading-[1.6] text-neutral-300 text-pretty">{cur.detail}</div>
          {over > 0 ? (
            <div className="flex items-center gap-[7px]">
              <Icon name="ph ph-hourglass-medium" className="flex-none text-[14px] text-over" />
              <span className="text-[11.5px] font-medium leading-[1.4] text-over">{over} min over — the sheet does not move itself</span>
            </div>
          ) : null}
          {holds ? (
            <div className="flex gap-[7px]">
              <button aria-label="Previous item" onClick={() => move(idx - 1)} disabled={idx === 0} className="flex min-h-12 w-12 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-300 disabled:opacity-40">
                <Icon name="ph ph-caret-left" className="text-[15px]" />
              </button>
              <Btn className="min-h-12 flex-1 justify-center" disabled={!nxt} onClick={() => move(idx + 1)}>
                {nxt ? 'Next · ' + nxt.time + ' ' + nxt.label : 'Last item on the sheet'}
              </Btn>
            </div>
          ) : (
            <div className="flex items-start gap-2 border-t border-divider pt-[10px]">
              <Icon name="ph ph-hand-tap" className="mt-[1px] flex-none text-[14px] text-neutral-500" />
              <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">{holderLabel} is moving the sheet tonight. This screen follows it — nothing advances on its own.</div>
            </div>
          )}
        </div>
      )}

      {cur?.debrief ? (
        <div className="sr-card flex flex-col gap-[13px] p-[14px]">
          <div>
            <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">Debrief</div>
            <div className="mt-[6px] text-[11.5px] leading-[1.55] text-neutral-400 text-pretty">Five minutes, standing up. Three things, then pray.</div>
          </div>
          <div className="flex items-start gap-2 rounded-md px-[11px] py-[10px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)' }}>
            <Icon name={outbox ? 'ph ph-cloud-slash' : 'ph-fill ph-check-circle'} className="mt-[1px] flex-none text-[15px]" style={{ color: outbox ? 'var(--color-over)' : 'var(--color-accent-300)' }} />
            <div className="text-[11.5px] leading-[1.5] text-neutral-300 text-pretty">
              {outbox ? outbox + (outbox === 1 ? ' item is' : ' items are') + ' still held on this phone. Stay on wifi — they send themselves.' : 'Everything tonight is on the board. Nothing is waiting to send.'}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-divider pt-3">
            <div className="text-[13px] font-medium leading-[1.2] text-neutral-100">Anyone to follow up on?</div>
            <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">
              A name here lands on Follow-ups › Team care with who flagged it and when. {openFollowups(d).length === 1 ? 'One person is on the care list' : openFollowups(d).length + ' people are on the care list'}.
            </div>
            {missing.length ? (
              <>
                <div className="mt-[2px] text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">Missing tonight</div>
                <div className="flex flex-wrap gap-[6px]">
                  {missing.map((n) => (
                    <button key={n} onClick={() => flagCare(n)} className="min-h-11 rounded-full border border-neutral-800 px-3 text-[11.5px] font-medium leading-none text-neutral-300 hover:bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)]">
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {!postedTeams.length ? <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">No squad has posted attendance yet, so the app cannot tell you who was missing. Type a name instead.</div> : null}
            <div className="flex gap-2">
              <input value={flagName} onChange={(e) => setFlagName(e.target.value)} className="input flex-1" placeholder="Or type a name" aria-label="Name to flag" />
              <Btn variant="secondary" className="flex-none px-[14px]" onClick={() => flagCare(flagName)}>
                Flag
              </Btn>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-divider pt-3">
            <div className="text-[13px] font-medium leading-[1.2] text-neutral-100">One thing to change next week</div>
            <textarea value={debriefNote} onChange={(e) => setDebriefNote(e.target.value)} className="input !min-h-[66px] text-[12.5px] leading-[1.6]" rows={2} placeholder="Games ran ten minutes long — start the relay at 7:40." aria-label="One thing to change" />
            <Btn variant="secondary" className="justify-center" onClick={fileNote}>
              File it on Week {d.config.weekNumber + 1}
            </Btn>
            {h.debriefNotes.map((n) => (
              <div key={n.id} className="flex items-start gap-2">
                <Icon name="ph-fill ph-check-circle" className="mt-[2px] flex-none text-[13px] text-accent-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-[1.5] text-neutral-300 text-pretty">{n.text}</div>
                  <div className="mt-[3px] text-[10px] leading-[1.3] text-neutral-500">Filed on Week {n.week}</div>
                </div>
              </div>
            ))}
          </div>
          <Btn className="min-h-12 justify-center" onClick={endNight}>
            {h.nightClosed ? 'Night closed ✓' : 'End the night'}
          </Btn>
          <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">Leaders get their report immediately. Parents get theirs on the scheduled send, not tonight.</div>
        </div>
      ) : null}

      {mine ? (
        <div className="sr-card flex flex-col gap-[11px] p-[14px]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-[10px] flex-none rounded-[3px]" style={{ background: mine.team ? teamOf(d, mine.team).color : 'var(--color-accent-500)' }} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Your post tonight</div>
              <div className="mt-[6px] text-[15px] font-medium leading-[1.25] text-neutral-100">{mine.post}</div>
              <div className="mt-1 text-[11px] leading-[1.4] text-neutral-500">
                {mine.job} · Send-home · {mine.sendHome}
              </div>
            </div>
          </div>
          <div className="flex gap-[7px]">
            {st(mine.id) !== 'here' ? (
              <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setCrew(mine.id, 'here')}>
                <Icon name="ph ph-check" className="text-[14px]" />
                I’m here
              </Btn>
            ) : null}
            {canEditRoster(m.persona) ? (
              <Btn className="flex-1 justify-center" onClick={() => router.push('/dashboard/coach-view')}>
                <Icon name="ph ph-megaphone" className="text-[14px]" />
                Open Coach view
              </Btn>
            ) : (
              <Btn className="flex-1 justify-center" onClick={() => router.push('/dashboard/games')}>
                <Icon name="ph ph-timer" className="text-[14px]" />
                Open the game timer
              </Btn>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-[2px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Run of show</div>
      <div className="sr-card flex flex-col gap-[2px] p-[6px]">
        {!sheet.length ? <div className="px-[10px] py-[14px] text-center text-[11.5px] leading-[1.5] text-neutral-500">Nothing on the sheet yet.</div> : null}
        {sheet.map((it, i) => {
          const isNow = i === idx;
          const done = i < idx;
          const open = openItem === it.id;
          return (
            <div key={it.id} className="rounded-md" style={{ background: isNow ? 'color-mix(in srgb, var(--color-accent) 13%, transparent)' : 'transparent', borderLeft: '3px solid ' + (isNow ? 'var(--color-accent-500)' : 'transparent') }}>
              <button onClick={() => setOpenItem(open ? null : it.id)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-[10px] px-[9px] py-[6px] text-left hover:opacity-80">
                <Icon name={done ? 'ph-fill ph-check-circle' : isNow ? 'ph-fill ph-caret-right' : 'ph ph-circle-dashed'} className="flex-none text-[15px]" style={{ color: done ? 'var(--color-accent-400)' : isNow ? 'var(--color-accent-300)' : 'var(--color-neutral-700)' }} />
                <span className="tabular w-[46px] flex-none text-[11.5px] font-semibold leading-none" style={{ color: isNow ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
                  {it.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-[1.25]" style={{ color: isNow ? 'var(--color-accent-100)' : done ? 'var(--color-neutral-500)' : 'var(--color-neutral-200)' }}>
                    {it.label}
                  </span>
                  <span className="mt-[3px] block text-[10.5px] leading-[1.3] text-neutral-500">
                    {it.where} · {it.who}
                    {it.assignedTo ? ' · ' + (crew.find((c) => c.id === it.assignedTo)?.name ?? '') : ''}
                  </span>
                </span>
                <Icon name={open ? 'ph ph-caret-up' : 'ph ph-caret-down'} className="flex-none text-[12px] text-neutral-500" />
              </button>
              {open ? (
                <div className="flex flex-col gap-[9px] pb-[11px] pl-[60px] pr-[11px]">
                  <div className="text-[11.5px] leading-[1.6] text-neutral-400 text-pretty">{it.detail}</div>
                  {holds && !isNow ? (
                    <Btn variant="ghost" className="self-start px-3" onClick={() => move(i)}>
                      {done ? 'Back to this' : 'Move the sheet here'}
                    </Btn>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-[2px] flex items-baseline gap-2">
        <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Serving tonight</div>
        <div className="tabular text-[10.5px] leading-none text-neutral-500">
          {nHere} of {crew.length} here
        </div>
      </div>
      <div className="-mt-[6px] text-[11px] leading-[1.5] text-neutral-500 text-pretty">
        {[nLate ? nLate + ' running late' : '', nOut ? nOut + ' not coming' : '', nBlank ? nBlank + ' not marked' : ''].filter(Boolean).join(' · ') || 'Everyone is accounted for'}. Tap the circle as people walk in; tap a name for late, out, or a text.
      </div>
      <div className="flex flex-col gap-[6px]">
        {crew.map((c) => {
          const cs = st(c.id);
          const meta = cs ? STM[cs] : BLANK;
          const open = openCrew === c.id;
          return (
            <div key={c.id} className="sr-card">
              <div className="flex items-center gap-[9px] px-[11px] py-2">
                <button aria-label={c.name + (cs === 'here' ? ' is here' : ' — mark here')} aria-pressed={cs === 'here'} onClick={() => setCrew(c.id, cs === 'here' ? null : 'here')} className="flex h-11 w-11 flex-none items-center justify-center hover:opacity-75">
                  <Icon name={meta.icon} className="text-[21px]" style={{ color: meta.fg }} />
                </button>
                <button onClick={() => setOpenCrew(open ? null : c.id)} aria-expanded={open} className="min-h-11 min-w-0 flex-1 text-left hover:opacity-80">
                  <div className="truncate text-[13px] font-medium leading-[1.2] text-neutral-200">
                    {c.name}
                    {mine?.id === c.id ? ' (you)' : ''}
                  </div>
                  <div className="mt-[3px] truncate text-[10.5px] leading-[1.3]" style={{ color: cs === 'out' ? 'var(--color-out)' : 'var(--color-neutral-500)' }}>
                    {c.job} · {c.post}
                  </div>
                </button>
                <span className="flex-none text-[10px] leading-none text-neutral-500">{meta.word}</span>
                <Icon name={open ? 'ph ph-caret-up' : 'ph ph-caret-down'} className="flex-none text-[12px] text-neutral-500" />
              </div>
              {open ? (
                <div className="flex flex-col gap-[9px] pb-[11px] pl-16 pr-[11px]">
                  <div className="text-[11px] leading-[1.5] text-neutral-500">Send-home · {c.sendHome}</div>
                  <div className="flex flex-wrap gap-[6px]">
                    <Btn variant="ghost" className="px-3" onClick={() => setCrew(c.id, 'here')}>
                      Here
                    </Btn>
                    <Btn variant="ghost" className="px-3" onClick={() => setCrew(c.id, 'late')}>
                      Running late
                    </Btn>
                    <Btn variant="ghost" className="px-3" onClick={() => setCrew(c.id, 'out')}>
                      Not coming
                    </Btn>
                    {/* SquadRise sends no texts and keeps no numbers: this opens the
                        phone's own messages app with the text written, and the
                        leader picks who it goes to. */}
                    <a
                      className="btn btn-secondary px-3"
                      href={'sms:?&body=' + encodeURIComponent('Hi ' + c.name.split(' ')[0] + ' — are you still on for tonight? You’re on ' + c.post + (c.job ? ' (' + c.job.toLowerCase() + ')' : '') + '. — ' + m.firstName)}
                      onClick={() => {
                        api().logActivity('Opened a text to ' + c.name + ' about tonight');
                        setOpenCrew(null);
                      }}
                      aria-label={'Text ' + c.name + ' from your phone'}
                    >
                      <Icon name="ph ph-chat-teardrop-text" className="text-[13px]" />
                      Text
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {uncovered.length ? (
        <div className="flex flex-col gap-[11px] rounded-lg border border-accent-700 px-[14px] py-[13px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
          <div>
            <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">{uncovered.length + (uncovered.length === 1 ? ' post has nobody on it' : ' posts have nobody on them')}</div>
            <div className="mt-[6px] text-[11px] leading-[1.5] text-neutral-400 text-pretty">Marking someone out opens their post here. Nothing else to keep in step.</div>
          </div>
          {uncovered.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-[10px]">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium leading-[1.25] text-neutral-100">{u.post}</div>
                <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{u.why}</div>
              </div>
              <Btn variant="secondary" className="flex-none px-[13px]" onClick={() => setBenchFor(benchFor === u.id ? null : u.id)}>
                {benchFor === u.id ? 'Close the bench' : 'Ask the bench'}
              </Btn>
            </div>
          ))}
          {benchFor ? (
            <div className="flex flex-col gap-[9px] border-t border-divider pt-[11px]">
              <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">Covering {uncovered.find((u) => u.id === benchFor)?.post}</div>
              <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Volunteers not serving tonight. Asking sends a text; tap again when they say yes.</div>
              {!bench.length ? <div className="text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">Everyone on the bench is already covering something tonight. This one needs a phone call.</div> : null}
              {bench.map((b) => {
                const asked = (h.subAsks[benchFor] ?? []).includes(b.id);
                return (
                  <div key={b.id} className="flex items-center gap-[10px]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">{b.name}</div>
                      <div className="mt-[3px] text-[10.5px] leading-[1.35] text-neutral-500">{asked ? 'Asked · ' + uncovered.find((u) => u.id === benchFor)?.post : b.meta}</div>
                    </div>
                    <button
                      onClick={() => (asked ? confirm(b.id) : ask(b.id))}
                      className="flex min-h-11 min-w-[82px] flex-none items-center justify-center rounded-full border px-[14px] text-[11.5px] font-medium leading-none hover:opacity-85"
                      style={{ borderColor: asked ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: asked ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: asked ? 'var(--color-accent-100)' : 'var(--color-neutral-300)' }}
                    >
                      {asked ? 'They said yes' : 'Ask'}
                    </button>
                  </div>
                );
              })}
              <Btn variant="ghost" className="justify-center" onClick={() => setBenchFor(null)}>
                Close the bench
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}
      {Object.keys(h.covered).length ? (
        <div className="flex flex-col gap-[5px]">
          {Object.values(h.covered).map((bid) => (
            <div key={bid} className="flex items-center gap-2">
              <Icon name="ph-fill ph-check-circle" className="flex-none text-[13px] text-accent-400" />
              <span className="text-[11.5px] leading-[1.4] text-neutral-400">{h.bench.find((b) => b.id === bid)?.name} is covering it</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="sr-card flex flex-col gap-[10px] p-[14px]">
        <div className="flex items-baseline gap-2">
          <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">The one thing</div>
          {canApprove(m.persona) && noteDraft == null ? (
            <Btn variant="ghost" className="-my-[10px] -mr-[6px] px-[11px]" onClick={() => setNoteDraft(h.note)}>
              Edit
            </Btn>
          ) : null}
        </div>
        {noteDraft == null ? (
          <div className="text-[13px] leading-[1.65] text-neutral-200 text-pretty">{h.note || 'Nothing yet.'}</div>
        ) : (
          <>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="input !min-h-[88px] text-[12.5px] leading-[1.6]" rows={3} placeholder="The one thing everyone needs to hear tonight." aria-label="The one thing" />
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setNoteDraft(null)}>
                Cancel
              </Btn>
              <Btn
                className="flex-[2] justify-center"
                onClick={() => {
                  const v = noteDraft.trim();
                  save((x) => {
                    x.note = v;
                  });
                  setNoteDraft(null);
                  api().logActivity('Huddle note updated');
                  api().say(v ? 'Everyone serving sees it when they open the huddle.' : 'Note cleared.');
                }}
              >
                Save for everyone
              </Btn>
            </div>
          </>
        )}
      </div>

      {topPrayer ? (
        <button onClick={() => router.push('/dashboard/follow-ups')} className="flex flex-col gap-[9px] rounded-lg border border-neutral-800 p-[14px] text-left hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]">
          <div className="flex items-center gap-2">
            <Icon name="ph ph-hands-praying" className="flex-none text-[15px] text-accent-300" />
            <span className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">Pray for this before you go out</span>
          </div>
          <div className="text-[12.5px] leading-[1.65] text-neutral-200 text-pretty">{topPrayer.body}</div>
          <div className="text-[10.5px] leading-[1.3] text-neutral-500">
            {topPrayer.who} · {topPrayer.praying} praying · {topPrayer.meta}
          </div>
        </button>
      ) : null}
    </Screen>
  );
}
