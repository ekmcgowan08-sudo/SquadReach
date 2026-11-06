'use client';
/* FOLLOW-UPS = the prayer wall + team care, one screen, one switch.
   Nothing here scores. Requests reach a leader first and only then the wall;
   care is coaches and leaders only, and anyone else never sees the tab. */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader, initialsOf } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { canReviewPrayer, canSeeCare } from '@/lib/permissions';
import { prayerLeaders, prayerMine, prayerReadable, prayerTakeable } from '@/lib/prayer';
import { careNotes, myTeamId, openFollowups, teamOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { CareReminder, PrayerQueued } from '@/lib/types/model';

type Tab = 'prayer' | 'care';

export function FollowUpsScreen() {
  const m = useApp((s) => s.membership);
  const params = useSearchParams();
  const care = canSeeCare(m.persona);
  const [tab, setTab] = useState<Tab>(care && params.get('tab') === 'care' ? 'care' : 'prayer');
  return (
    <Screen label={tab === 'care' ? 'Care' : 'Prayer'} gap={16.8}>
      <ScreenHeader title={care ? 'Follow-ups' : 'Prayer Wall'} back="/dashboard/more" right={tab === 'care' ? <Icon name="ph-fill ph-lock-simple" className="text-[15px] text-neutral-500" /> : undefined} />
      {care ? (
        <div className="flex gap-[7px]">
          {(['prayer', 'care'] as const).map((id) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-pressed={on}
                className="min-h-11 flex-1 rounded-md border text-[12.5px] font-medium leading-none"
                style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
              >
                {id === 'prayer' ? 'Prayer wall' : 'Team care'}
              </button>
            );
          })}
        </div>
      ) : null}
      {tab === 'care' && care ? <TeamCare /> : <PrayerWall />}
    </Screen>
  );
}

function PrayerWall() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const [draft, setDraft] = useState('');
  const [anon, setAnon] = useState(false);
  const reviewer = canReviewPrayer(m.persona);
  const ready = draft.trim().length >= 12;
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const [handFor, setHandFor] = useState<string | null>(null);
  const mineToPost = d.prayerQueue.filter((q) => prayerMine(q, m));

  /* Take one to read it, or hand yours to another leader. Only its leader
     reads it, so taking it is a deliberate act the audit log keeps. */
  const take = async (q: PrayerQueued, to: { id: string; name: string } | null) => {
    setHandFor(null);
    const b = api().backend;
    if (b.takePrayer) {
      if (offline) return api().say('No signal — taking a request needs a connection.');
      try {
        const r = await b.takePrayer(q.id, to?.id ?? null);
        api().mutate((x) => {
          const it = x.prayerQueue.find((y) => y.id === q.id);
          if (it) Object.assign(it, { owner: r.owner, ownerId: to?.id ?? m.membershipId, mine: r.mine, sealed: r.body == null, body: r.body ?? '' });
        });
      } catch (e) {
        return api().say(/already with/.test((e as Error).message) ? 'Another leader has it already — only they, or an owner, can hand it on.' : 'Couldn’t take it — try again with a signal.');
      }
    } else {
      api().mutate((x) => {
        const it = x.prayerQueue.find((y) => y.id === q.id);
        if (it) it.owner = to?.name ?? m.displayName;
      });
      api().logActivity(to ? 'Handed a prayer request from ' + q.who + ' to ' + to.name : 'Took a prayer request from ' + q.who + ' to read');
    }
    api().say(to ? 'Handed to ' + to.name + '. Only they read it now.' : 'It’s yours. Only you read it until it’s on the wall.');
  };

  const submit = () => {
    const body = draft.trim();
    if (body.length < 12) {
      api().say('A sentence or two, so they know how to pray.');
      return;
    }
    const me = m.studentName ?? m.displayName;
    const student = d.roster.find((r) => r.name === me);
    const who = anon ? 'Anonymous' : me;
    const team = myTeamId(m, d, coachTeam);
    const meta = 'submitted just now · ' + (anon ? (student ? student.grade + 'th grade' : 'kept private') : team ? teamOf(d, team).name : m.firstName);
    const item: PrayerQueued = { id: uid(), who, meta, body, at: nowMs() };
    api().mutate((x) => {
      x.prayerQueue.unshift(item);
    });
    api().emit({ kind: 'prayerSubmit', item, anonymous: anon });
    api().logActivity('Prayer request submitted by ' + who + ' — waiting on a leader');
    api().notify('New prayer request', who + ' sent one in · nothing is public yet', '/dashboard/follow-ups');
    setDraft('');
    setAnon(false);
    api().say(reviewer ? 'Filed with the requests below. Post it or hold it from there.' : 'Sent. A leader prays over it before anything is posted.');
  };

  const post = (ids: string[]) => {
    api().mutate((x) => {
      const moving = x.prayerQueue.filter((q) => ids.includes(q.id));
      x.prayerQueue = x.prayerQueue.filter((q) => !ids.includes(q.id));
      x.prayers.unshift(...moving.map((q) => ({ id: q.id, who: q.who, meta: 'Just now · posted by a leader', body: q.body, praying: 0, prayed: false, answered: false, at: nowMs() })));
    });
    api().emit({ kind: 'prayerPost', ids });
    api().logActivity('Posted ' + (ids.length === 1 ? 'a prayer request' : ids.length + ' prayer requests') + ' to the wall');
    api().say(ids.length === 1 ? 'On the wall. Nobody sees who approved it.' : 'Posted all ' + ids.length + ' requests to the wall.');
  };

  const hold = (q: PrayerQueued) => {
    const item: CareReminder = { id: uid(), kind: 'followup', initials: q.who === 'Anonymous' ? '··' : initialsOf(q.who), name: q.who, meta: 'Held prayer request · talk before posting · ' + m.firstName, flaggedBy: m.displayName, at: nowMs() };
    api().mutate((x) => {
      x.prayerQueue = x.prayerQueue.filter((y) => y.id !== q.id);
      x.careReminders.push(item);
    });
    api().emit({ kind: 'prayerHold', id: q.id });
    api().emit({ kind: 'careAdd', item });
    api().logActivity('Held a prayer request from ' + q.who + ' to talk first');
    api().say('Held. Added to Team care as a follow-up for you.');
  };

  const pray = (id: string) => {
    const p = d.prayers.find((x) => x.id === id);
    if (!p) return;
    const on = !p.prayed;
    api().mutate((x) => {
      const r = x.prayers.find((y) => y.id === id);
      if (r) {
        r.prayed = on;
        r.praying = Math.max(0, r.praying + (on ? 1 : -1));
      }
    });
    api().emit({ kind: 'prayerPraying', id, on });
  };

  const answered = (id: string) => {
    const p = d.prayers.find((x) => x.id === id);
    if (!p) return;
    api().mutate((x) => {
      const r = x.prayers.find((y) => y.id === id);
      if (r) r.answered = !r.answered;
    });
    api().emit({ kind: 'prayerAnswered', id, on: !p.answered });
    if (!p.answered) api().say('Marked answered — the wall keeps it up as a testimony.');
  };

  return (
    <>
      <div className="max-w-[300px] text-[12px] leading-[1.6] text-neutral-500 text-pretty">Nothing here scores anything. Requests reach a leader first, and only then the wall.</div>

      <div className="flex flex-col gap-[10px] rounded-lg border border-accent-700 px-[15px] py-[14px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}>
        <div className="flex items-center gap-2">
          <Icon name="ph ph-hands-praying" className="text-[15px] text-accent-300" />
          <div className="flex-1 text-[13.5px] font-medium leading-[1.2] text-neutral-100">Add a request</div>
          <span className="text-[10.5px] leading-none text-neutral-500">{ready ? 'Ready to send' : 'Leaders read it first'}</span>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="input !min-h-[88px]" placeholder="What do you want prayed for?" aria-label="Prayer request" />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAnon((v) => !v)}
            aria-pressed={anon}
            className="flex min-h-11 items-center gap-[7px] rounded-full border px-3 text-[11.5px] font-medium leading-none"
            style={{ borderColor: anon ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: anon ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: anon ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            <Icon name={anon ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[13px]" />
            Leave my name off
          </button>
          <Btn className="ml-auto px-4" onClick={submit}>
            {reviewer ? 'File for review' : 'Send to my leaders'}
          </Btn>
        </div>
        <div className="text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">
          {reviewer ? 'Filed with the requests below. Hold it or post it to the wall from there — nothing goes public on its own.' : 'It reaches a leader first. Nothing appears on the wall until a leader posts it.'}
        </div>
      </div>

      {reviewer && d.prayerQueue.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Waiting for review · {d.prayerQueue.length}</div>
          <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Each request is read by the one leader who has it. Take one to read it; the others see that it’s waiting, and who has it.</div>
          {mineToPost.length > 1 ? (
            <div className="flex gap-2">
              <Btn variant="secondary" className="px-3" onClick={() => post(mineToPost.map((q) => q.id))}>
                Post all {mineToPost.length} of yours to the wall
              </Btn>
            </div>
          ) : null}
          {d.prayerQueue.map((q) => {
            const mine = prayerMine(q, m);
            const readable = prayerReadable(q, m);
            const others = prayerLeaders(d, m).filter((l) => l.name !== m.displayName && l.id !== m.membershipId && l.name !== q.owner);
            return (
              <div key={q.id} className="sr-card animate-[sr-rise_.25s_ease_both] px-[15px] py-[16.8px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium leading-none text-neutral-300">{q.who}</span>
                  <span className="text-[11px] leading-none text-neutral-500">{q.meta}</span>
                  <span className="ml-auto rounded-full border px-2 py-[3px] text-[10px] font-medium leading-none" style={{ borderColor: mine ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: mine ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
                    {mine ? 'Yours' : q.owner ? 'With ' + q.owner : 'Nobody has it yet'}
                  </span>
                </div>
                {readable ? (
                  <div className="mt-[11.2px] text-[14px] leading-[1.6] text-neutral-200 text-pretty">{q.body}</div>
                ) : (
                  <div className="mt-[11.2px] flex items-center gap-2 text-[12px] leading-[1.5] text-neutral-500">
                    <Icon name="ph ph-lock-simple" className="flex-none text-[14px]" />
                    {q.owner ? 'Only ' + q.owner + ' reads this one.' : 'Take it to read it. Once you have it, only you do.'}
                  </div>
                )}
                {mine ? (
                  <>
                    <div className="mt-[16.8px] flex gap-[8.4px]">
                      <Btn variant="ghost" className="flex-1 justify-center" onClick={() => hold(q)}>
                        Hold &amp; talk first
                      </Btn>
                      <Btn className="flex-1 justify-center" onClick={() => post([q.id])}>
                        Post to wall
                      </Btn>
                    </div>
                    {others.length ? (
                      handFor === q.id ? (
                        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={'Hand ' + q.who + '’s request to'}>
                          {others.map((l) => (
                            <Btn key={l.id} variant="secondary" className="px-3 text-[12px]" onClick={() => void take(q, l)}>
                              {l.name}
                            </Btn>
                          ))}
                          <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => setHandFor(null)}>
                            Keep it
                          </Btn>
                        </div>
                      ) : (
                        <button onClick={() => setHandFor(q.id)} className="mt-1 min-h-11 text-[12px] font-medium text-accent-300">
                          Hand it to another leader
                        </button>
                      )
                    ) : null}
                  </>
                ) : prayerTakeable(q, m) ? (
                  <Btn variant="secondary" className="mt-[14px] w-full justify-center" onClick={() => void take(q, null)}>
                    {q.owner ? 'Take it over from ' + q.owner : 'Take it to read'}
                  </Btn>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-[8.4px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">On the wall</div>
        {!d.prayers.length ? <div className="text-[12px] leading-[1.5] text-neutral-500">Nothing on the wall yet. Requests posted by leaders will show up here.</div> : null}
        {d.prayers.map((p) => (
          <div key={p.id} className="sr-card animate-[sr-rise_.25s_ease_both] px-[15px] py-[16.8px]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium leading-none text-neutral-300">{p.who}</span>
              <span className="text-[11px] leading-none text-neutral-500">{p.meta}</span>
              <span className="ml-auto text-[10px] font-medium uppercase leading-none tracking-[.08em]" style={{ color: p.answered ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                {p.answered ? 'answered' : 'praying'}
              </span>
            </div>
            <div className="mt-[11.2px] text-[14px] leading-[1.65] text-neutral-200 text-pretty">{p.body}</div>
            <div className="mt-[16.8px] flex items-center gap-[8.4px] border-t border-divider pt-[11.2px]">
              <button
                onClick={() => pray(p.id)}
                aria-pressed={p.prayed}
                className="flex min-h-11 items-center gap-[7px] rounded-full border bg-transparent px-3 text-[11.5px] font-medium leading-none"
                style={{ borderColor: p.prayed ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: p.prayed ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}
              >
                <Icon name={p.prayed ? 'ph-fill ph-hands-praying' : 'ph ph-hands-praying'} className="text-[14px]" />
                {p.praying} praying
              </button>
              {canReviewPrayer(m.persona) ? (
                <button onClick={() => answered(p.id)} className="sr-hover ml-auto min-h-11 rounded-full border border-neutral-800 bg-transparent px-3 text-[11.5px] font-medium leading-none text-neutral-400">
                  {p.answered ? 'Answered ✓' : 'Mark answered'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TeamCare() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const [composing, setComposing] = useState(false);
  const [who, setWho] = useState('');
  const [body, setBody] = useState('');
  const follow = openFollowups(d);
  const notes = careNotes(d);
  const names = d.roster.map((r) => r.name);
  const match = who.trim() ? names.filter((n) => n.toLowerCase().includes(who.trim().toLowerCase())).slice(0, 4) : [];

  const done = (r: CareReminder) => {
    api().mutate((x) => {
      x.careReminders = x.careReminders.filter((y) => y.id !== r.id);
    });
    api().emit({ kind: 'careDone', id: r.id });
    api().logActivity('Reached out to ' + r.name + ' — follow-up closed');
    api().say('Logged as reached out. ' + (r.flaggedBy && r.flaggedBy !== m.displayName ? r.flaggedBy + ' can see the follow-up closed.' : 'The follow-up is closed.'));
  };

  const save = () => {
    const name = who.trim();
    const text = body.trim();
    if (!name || text.length < 8) {
      api().say('Who it’s about, and a line or two about what you saw.');
      return;
    }
    const item: CareReminder = { id: uid(), kind: 'note', initials: initialsOf(name), name, meta: m.displayName + ' · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), flaggedBy: m.displayName, at: nowMs(), body: text };
    api().mutate((x) => {
      x.careReminders.push(item);
    });
    api().emit({ kind: 'careAdd', item });
    /* The audit line names the author and the student, never the note. */
    api().logActivity('Private care note added about ' + name);
    setComposing(false);
    setWho('');
    setBody('');
    api().say('Saved. Only coaches and leaders can read it.');
  };

  return (
    <>
      <div className="max-w-[300px] text-[12px] leading-[1.6] text-neutral-500 text-pretty">Coaches and leaders only — the tightest table in the system. Students, captains and scorekeepers never see this screen exists.</div>

      <div className="flex flex-col gap-[8.4px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Follow up · {follow.length}</div>
        {!follow.length ? <div className="text-[12px] leading-[1.5] text-neutral-500">Nobody on the list. Names flagged in the huddle or held from the prayer queue land here.</div> : null}
        {follow.map((r) => (
          <div key={r.id} className="sr-card flex animate-[sr-rise_.25s_ease_both] items-center gap-[11.2px] px-[15px] py-[16.8px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold leading-none text-neutral-200" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
              {r.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium leading-[1.3] text-neutral-200">{r.name}</div>
              <div className="mt-[3px] text-[11.5px] leading-[1.4] text-neutral-500">
                {r.meta}
              </div>
            </div>
            <button onClick={() => done(r)} className="sr-hover min-h-11 flex-none rounded-md border border-neutral-800 bg-transparent px-3 text-[11.5px] font-medium leading-none text-neutral-300">
              Reached out
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[8.4px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Recent notes</div>
        {!notes.length ? <div className="text-[12px] leading-[1.5] text-neutral-500">No notes yet.</div> : null}
        {notes.map((n) => (
          <div key={n.id} className="sr-card px-[15px] py-[16.8px]">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium leading-none text-neutral-200">{n.name}</span>
              <span className="text-[10.5px] leading-none text-neutral-500">{n.meta}</span>
            </div>
            <div className="mt-[11.2px] text-[13.5px] leading-[1.65] text-neutral-300 text-pretty">{n.body}</div>
          </div>
        ))}
      </div>

      <Btn variant="secondary" className="min-h-12 justify-center" onClick={() => setComposing(true)}>
        Add a private note
      </Btn>
      <div className="text-[10.5px] leading-[1.6] text-neutral-500 text-pretty">Every note here is written to the audit log with your name on it. Care records are visible to the org admins by design, not by accident.</div>

      <Sheet open={composing} onClose={() => setComposing(false)} label="Private note" z={92}>
        <div className="flex items-center gap-2">
          <Icon name="ph-fill ph-lock-simple" className="text-[14px] text-neutral-500" />
          <div className="flex-1 text-[15px] font-medium leading-[1.2] text-neutral-100">Private note</div>
          <button aria-label="Close" onClick={() => setComposing(false)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-500">
            <Icon name="ph ph-x" className="text-[13px]" />
          </button>
        </div>
        <label className="field">
          <span className="sr-label">About</span>
          <input className="input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Student name" aria-label="Who this note is about" />
        </label>
        {match.length && !names.includes(who.trim()) ? (
          <div className="flex flex-wrap gap-[6px]">
            {match.map((n) => (
              <button key={n} onClick={() => setWho(n)} className="min-h-11 rounded-full border border-neutral-800 px-3 text-[11.5px] leading-none text-neutral-300">
                {n}
              </button>
            ))}
          </div>
        ) : null}
        <label className="field">
          <span className="sr-label">What you saw</span>
          <textarea className="input !min-h-[110px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s going on, and what you did or want to do about it." aria-label="Note" />
        </label>
        <Btn className="min-h-12 justify-center" onClick={save}>
          Save note
        </Btn>
      </Sheet>
    </>
  );
}
