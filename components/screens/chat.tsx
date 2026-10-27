'use client';
/* CHAT — announcements, the volunteer thread, one thread per squad and (on
   the demo) direct messages. Who reads and who posts is the thread's own
   rule, the same one the database enforces with chat_can(). */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Icon, Screen, initialsOf } from '@/components/ui';
import { dmThread, dmThreadId } from '@/lib/chat-dm';
import { canApprove, holdsSheet } from '@/lib/permissions';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { chatThreadsFor, openChatFlags, teamOf } from '@/lib/selectors';
import { sendChat } from '@/lib/store/actions';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { personaDef } from '@/lib/types/domain';
import type { ChatThread } from '@/lib/types/model';

export function ChatScreen() {
  const params = useSearchParams();
  const open = params.get('t');
  return open ? <ThreadView id={open} /> : <ThreadList />;
}

function ThreadList() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'groups' | 'dms'>('all');
  const [composer, setComposer] = useState(false);
  const p = m.persona;
  /* Demo: the volunteer set starts messages. With accounts, anyone can — the
     directory only offers who the database will let them reach. */
  const canDm = m.mode === 'demo' ? holdsSheet(p) : !!m.membershipId;
  const needle = q.trim().toLowerCase();
  const coachTeam = useApp((s) => s.coachTeam);
  const mineName = (from?: string) => !!from && (from === m.displayName || from.startsWith(m.displayName + ' '));
  const muted = usePrefs().chatMuted;
  const leader = canApprove(p);
  const threads = chatThreadsFor(d, m, coachTeam)
    .filter((t) => (filter === 'groups' ? t.kind !== 'dm' : filter === 'dms' ? t.kind === 'dm' : true))
    .filter((t) => !needle || t.name.toLowerCase().includes(needle) || (d.chatMsgs[t.id] ?? []).some((x) => x.text.toLowerCase().includes(needle)))
    .map((t) => {
      const msgs = d.chatMsgs[t.id] ?? [];
      /* A muted thread still lists; it just never counts as unread. */
      return { t, last: msgs[msgs.length - 1], unread: muted[t.id] ? 0 : (d.chatUnread[t.id] ?? 0), muted: !!muted[t.id], flagged: leader && openChatFlags(d, t.id).length > 0 };
    })
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));

  return (
    <Screen label="Chat" gap={12}>
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 text-[25px] font-medium leading-[1.15] text-neutral-100">Chat</div>
        {canDm ? (
          <button aria-label="New message" onClick={() => setComposer(true)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-accent-600 text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
            <Icon name="ph ph-note-pencil" className="text-[16px]" />
          </button>
        ) : null}
      </div>
      {offline ? (
        <div className="flex items-center gap-[9px] rounded-md border border-neutral-700 px-3 py-[9px]" style={{ background: 'color-mix(in srgb, var(--color-neutral-800) 60%, transparent)' }}>
          <Icon name="ph ph-cloud-slash" className="flex-none text-[15px] text-neutral-400" />
          <div className="text-[11px] leading-[1.45] text-neutral-400 text-pretty">No signal. You can read everything already here — anything you send waits on this phone and goes when you reconnect.</div>
        </div>
      ) : null}
      <div className="relative">
        <Icon name="ph ph-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and threads" aria-label="Search chat" className="input w-full !pl-[34px]" />
      </div>
      <div className="flex gap-[6px]">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'groups', label: 'Groups' },
            { id: 'dms', label: 'Direct' }
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className="relative min-h-11 flex-1 rounded-full border text-[11.5px] font-medium leading-none"
            style={{ borderColor: filter === f.id ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: filter === f.id ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: filter === f.id ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {threads.length ? (
        <div className="sr-card overflow-hidden">
          {threads.map(({ t, last, unread, muted: quiet, flagged }) => (
            <button key={t.id} onClick={() => router.push('/dashboard/chat?t=' + encodeURIComponent(t.id))} className="flex w-full items-center gap-[11px] border-t border-divider px-[14px] py-3 text-left first:border-t-0 hover:bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]">
              <ThreadAvatar t={t} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-[6px]">
                  <span className="truncate text-[13.5px] leading-[1.2]" style={{ color: unread ? 'var(--color-neutral-100)' : 'var(--color-neutral-200)', fontWeight: unread ? 600 : 500 }}>
                    {t.name}
                  </span>
                  {quiet ? (
                    <>
                      <Icon name="ph ph-bell-slash" className="flex-none self-center text-[12px] text-neutral-500" />
                      <span className="sr-only">, muted</span>
                    </>
                  ) : null}
                  {flagged ? (
                    <span className="flex flex-none items-center gap-[3px] self-center text-[10px] font-semibold uppercase leading-none tracking-[.06em] text-accent-200">
                      <Icon name="ph-fill ph-flag" className="text-[11px]" />
                      Flagged
                    </span>
                  ) : null}
                  <span className="ml-auto flex-none text-[10.5px] leading-none text-neutral-500">{last ? (last.day === 'Today' ? last.time : last.day) : ''}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] leading-[1.4]" style={{ color: unread ? 'var(--color-neutral-300)' : 'var(--color-neutral-500)' }}>
                    {last ? (last.system ? last.text : (last.mine || mineName(last.from) ? 'You' : last.from) + ': ' + last.text) : t.sub}
                  </span>
                  {unread ? <span className="h-[18px] min-w-[18px] flex-none rounded-full bg-accent-700 px-[5px] text-center text-[10px] font-semibold leading-[18px] text-accent-100">{unread}</span> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-[9px] px-[18px] py-[34px] text-center">
          <Icon name="ph ph-chats-circle" className="text-[26px] text-neutral-500" />
          <div className="text-[12px] leading-[1.6] text-neutral-500 text-pretty">{needle ? 'Nothing matches that.' : 'No threads for your role yet.'}</div>
        </div>
      )}
      <div className="border-t border-divider pt-[10px] text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">
        {holdsSheet(p) ? 'You see the volunteer thread and every squad’s. Students only see their own squad and the announcements.' : 'You see the announcements and your own squad’s thread. Leaders can read every thread here.'}
      </div>
      {canDm ? <NewMessage open={composer} onClose={() => setComposer(false)} /> : null}
    </Screen>
  );
}

function ThreadAvatar({ t, size }: { t: ChatThread; size: number }) {
  return (
    <div className="flex flex-none items-center justify-center text-[12.5px] font-semibold leading-none text-neutral-100" style={{ width: size, height: size, borderRadius: t.kind === 'dm' ? 9999 : 10, background: 'color-mix(in srgb, ' + t.tint + ' 70%, var(--color-neutral-900))' }}>
      {t.icon ? <Icon name={t.icon} className="text-[17px]" /> : initialsOf(t.name)}
    </div>
  );
}

function ThreadView({ id }: { id: string }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const coachTeam = useApp((s) => s.coachTeam);
  const t = chatThreadsFor(d, m, coachTeam).find((x) => x.id === id);
  const msgs = useMemo(() => d.chatMsgs[id] ?? [], [d.chatMsgs, id]);
  const canRead = !!t && t.read.includes(m.persona);
  const canPost = !!t && t.post.includes(m.persona);
  const muted = !!usePrefs().chatMuted[id];
  const [menu, setMenu] = useState(false);
  const firstItem = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (menu) firstItem.current?.focus();
  }, [menu]);

  useEffect(() => {
    if ((api().data.chatUnread[id] ?? 0) > 0) api().mutate((x) => void (x.chatUnread[id] = 0));
  }, [id, msgs.length, api]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs.length]);

  if (!t || !canRead) {
    return (
      <Screen label="Chat thread">
        <button onClick={() => router.push('/dashboard/chat')} className="self-start text-[12px] text-accent-300">
          ← Chat
        </button>
        <div className="rounded-lg border border-dashed border-neutral-700 px-4 py-6 text-center text-[12px] text-neutral-500">That thread isn’t open to your role.</div>
      </Screen>
    );
  }
  const student = t.kind === 'dm' && d.roster.some((r) => r.name === t.name);
  const flags = openChatFlags(d, id);
  const mine = flags.find((f) => f.by === m.displayName);
  const leader = canApprove(m.persona);
  const toggleMute = () => {
    const on = !muted;
    setPrefs((pr) => ({ chatMuted: { ...pr.chatMuted, [id]: on } }));
    setMenu(false);
    api().say(on ? t.name + ' muted — it still shows here, it just won’t count as unread.' : t.name + ' unmuted.');
  };
  const markUnread = () => {
    api().mutate((x) => void (x.chatUnread[id] = Math.max(1, x.chatUnread[id] ?? 0)));
    api().say('Left unread.');
    router.push('/dashboard/chat');
  };
  /* A flag goes to the ministry's leaders with the flagger's name on it,
     and lets them read the thread even if they otherwise couldn't. */
  const flag = () => {
    setMenu(false);
    const f = { id: uid(), thread: id, threadName: t.name, by: m.displayName, at: Date.now() };
    api().mutate((x) => void x.chatFlags.push(f));
    api().emit({ kind: 'chatFlag', flag: f });
    api().logActivity('Flagged the ' + t.name + ' thread for a leader to read');
    api().say('Flagged. The ministry’s leaders get the thread, with your name on the flag.');
  };
  const markRead = () => {
    for (const f of flags) {
      api().mutate((x) => {
        const r = x.chatFlags.find((y) => y.id === f.id);
        if (r) Object.assign(r, { seenBy: m.displayName, seenAt: Date.now() });
      });
      api().emit({ kind: 'chatFlagSeen', id: f.id });
    }
    api().logActivity('Read the flagged ' + t.name + ' thread');
    api().say('Marked read. The flag stays on record.');
  };
  const send = () => {
    if (!draft.trim()) return;
    sendChat(api, id, draft);
    setDraft('');
  };

  return (
    <div data-screen-label="Chat thread" className="flex min-h-full flex-col">
      <div className="sticky top-0 z-[3] flex items-center gap-[9px] border-b border-divider px-[14px] py-2 backdrop-blur-[10px]" style={{ background: 'color-mix(in srgb, var(--color-bg) 90%, #000)' }}>
        <button aria-label="Back to chat" onClick={() => router.push('/dashboard/chat')} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
          <Icon name="ph ph-caret-left" className="text-[14px]" />
        </button>
        <ThreadAvatar t={t} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium leading-[1.2] text-neutral-100">{t.name}</div>
          <div className="mt-[2px] text-[10.5px] leading-[1.3] text-neutral-500">
            {t.sub}
            {muted ? ' · muted' : ''}
          </div>
        </div>
        <div className="relative flex-none">
          <button aria-label="Thread options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
            <Icon name="ph ph-dots-three-vertical" className="text-[16px]" />
          </button>
          {menu ? (
            <>
              <div aria-hidden="true" className="fixed inset-0 z-[4]" onClick={() => setMenu(false)} />
              <div
                role="menu"
                aria-label="Thread options"
                onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setMenu(false))}
                className="absolute right-0 top-[50px] z-[5] flex w-[230px] flex-col rounded-lg border border-neutral-800 bg-surface py-1 shadow-lg"
              >
                <button ref={firstItem} role="menuitem" onClick={toggleMute} className="flex min-h-11 items-center gap-[10px] px-3 text-left text-[13px] text-neutral-200 sr-hover">
                  <Icon name={muted ? 'ph ph-bell' : 'ph ph-bell-slash'} className="text-[15px] text-neutral-400" />
                  {muted ? 'Unmute this thread' : 'Mute this thread'}
                </button>
                <button role="menuitem" onClick={markUnread} className="flex min-h-11 items-center gap-[10px] px-3 text-left text-[13px] text-neutral-200 sr-hover">
                  <Icon name="ph ph-envelope-simple" className="text-[15px] text-neutral-400" />
                  Mark unread
                </button>
                <button role="menuitem" onClick={flag} disabled={!!mine} className="flex min-h-11 items-center gap-[10px] px-3 text-left text-[13px] text-accent-200 sr-hover disabled:text-neutral-500">
                  <Icon name="ph ph-flag" className="text-[15px]" />
                  {mine ? 'You flagged this' : 'Flag for a leader'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {flags.length && leader ? (
        <div role="status" className="mx-[14px] mt-[10px] flex items-start gap-[9px] rounded-md border border-accent-600 px-3 py-[9px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
          <Icon name="ph-fill ph-flag" className="mt-[1px] flex-none text-[14px] text-accent-200" />
          <div className="min-w-0 flex-1 text-[11.5px] leading-[1.5] text-accent-100 text-pretty">
            Flagged for a leader by {flags.map((f) => f.by).join(', ')} · {new Date(flags[0].at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Read it through, then mark it read — the flag stays on record.
          </div>
          <button onClick={markRead} className="min-h-11 flex-none rounded-md border border-accent-600 px-3 text-[12px] font-medium text-accent-100">
            Mark read
          </button>
        </div>
      ) : mine ? (
        <div className="mx-[14px] mt-[10px] flex items-start gap-[9px] rounded-md border border-neutral-800 px-3 py-[9px]">
          <Icon name="ph ph-flag" className="mt-[1px] flex-none text-[14px] text-neutral-400" />
          <div className="text-[11px] leading-[1.5] text-neutral-400 text-pretty">You flagged this for a leader. They can read it, and your name is on the flag.</div>
        </div>
      ) : null}
      {student ? (
        <div className="mx-[14px] mt-[10px] flex items-start gap-[9px] rounded-md border border-accent-700 px-3 py-[9px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 9%, transparent)' }}>
          <Icon name="ph ph-eye" className="mt-[1px] flex-none text-[14px] text-accent-300" />
          <div className="text-[10.5px] leading-[1.5] text-accent-200 text-pretty">Open door. Adult–student messages are copied to two ministry leaders. Both of you can see that this is on.</div>
        </div>
      ) : null}
      {msgs.length ? (
        <div className="flex flex-1 flex-col gap-[9px] px-4 pb-[10px] pt-[14px]">
          {msgs.map((x, k) => {
            const showDay = k === 0 || x.day !== msgs[k - 1].day;
            return (
              <div key={x.id} className="flex flex-col gap-[9px]">
                {showDay ? <div className="self-center py-[6px] text-[9.5px] font-medium uppercase leading-none tracking-[.1em] text-neutral-500">{x.day}</div> : null}
                {x.system ? (
                  <div className="max-w-[82%] self-center text-center text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">{x.text}</div>
                ) : (
                  <div className="flex max-w-[86%] gap-2" style={{ alignSelf: x.mine ? 'flex-end' : 'flex-start' }}>
                    {!x.mine ? (
                      <div className="mt-auto flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[9.5px] font-semibold leading-none text-neutral-100" style={{ background: 'color-mix(in srgb, ' + (x.tint ?? t.tint) + ' 70%, var(--color-neutral-900))' }}>
                        {initialsOf(x.from ?? '?')}
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      {!x.mine && t.kind !== 'dm' ? (
                        <div className="mb-1 ml-[2px] text-[10.5px] font-medium leading-none text-neutral-500">
                          {x.from}
                          {x.roleLabel ? ' · ' + x.roleLabel : ''}
                        </div>
                      ) : null}
                      <div
                        className="whitespace-pre-wrap rounded-lg border px-3 py-[9px] text-[12.5px] leading-[1.5] text-pretty"
                        style={{
                          borderColor: x.mine ? 'var(--color-accent-700)' : 'var(--color-neutral-800)',
                          background: x.mine ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'var(--color-surface)',
                          color: x.mine ? 'var(--color-accent-100)' : 'var(--color-neutral-200)'
                        }}
                      >
                        {x.text}
                      </div>
                      <div className="mt-1 flex items-center gap-[5px]" style={{ justifyContent: x.mine ? 'flex-end' : 'flex-start' }}>
                        {x.mine && x.status === 'pending' ? <Icon name="ph ph-clock" className="text-[10px] text-accent-300" /> : null}
                        <span className="text-[9.5px] leading-none" style={{ color: x.mine && x.status === 'pending' ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                          {x.mine && x.status === 'pending' ? 'Held — sends when you reconnect' : x.time}
                        </span>
                        {x.mine && x.status === 'pending' && !offline ? (
                          <button onClick={() => api().resendSoftHeld()} className="px-1 py-[2px] text-[9.5px] font-medium text-accent-300 underline">
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={end} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[9px] px-6 py-11 text-center">
          <Icon name="ph ph-paper-plane-tilt" className="text-[24px] text-neutral-500" />
          <div className="text-[12px] leading-[1.6] text-neutral-500 text-pretty">{canPost ? 'Nothing here yet. Say hi.' : 'Nothing posted here yet.'}</div>
        </div>
      )}
      <div className="sticky bottom-0 border-t border-divider px-[14px] pb-[14px] pt-[10px] backdrop-blur-[10px]" style={{ background: 'color-mix(in srgb, var(--color-bg) 90%, #000)' }}>
        {canPost ? (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={t.kind === 'announce' ? 'Post to everyone…' : 'Message ' + t.name}
                aria-label="Message"
                className="input !min-h-11 max-h-[120px] flex-1 resize-none !py-3"
              />
              <button aria-label="Send" onClick={send} disabled={!draft.trim()} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-accent-500 text-accent-100 disabled:opacity-40" style={{ background: 'color-mix(in srgb, var(--color-accent) 22%, transparent)' }}>
                <Icon name="ph-fill ph-paper-plane-right" className="text-[15px]" />
              </button>
            </div>
            <div className="mt-[6px] text-[9.5px] leading-[1.4] text-neutral-500">{t.kind === 'announce' ? 'Everyone in the ministry sees this.' : offline ? 'No signal — it waits on this phone.' : 'Enter sends · Shift+Enter for a new line'}</div>
          </>
        ) : (
          <div className="flex items-center gap-[9px] rounded-md border border-neutral-800 px-[13px] py-[11px]" style={{ background: 'color-mix(in srgb, var(--color-neutral-800) 45%, transparent)' }}>
            <Icon name="ph ph-lock-simple" className="flex-none text-[15px] text-neutral-500" />
            <div className="text-[11px] leading-[1.45] text-neutral-500 text-pretty">{t.kind === 'announce' ? 'Announcements come from leaders and coaches. Reply in your squad’s thread.' : 'This thread is read-only for your role.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Start a direct message. Adults on the team can message each other
 *  privately; a thread with a student is open door — every leader can read
 *  it. Students can't message each other. */
function NewMessage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const router = useRouter();
  const [q, setQ] = useState('');
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (m.mode === 'supabase') {
      return (d.chatDirectory ?? [])
        .filter((x) => x.id !== m.membershipId)
        .map((x) => ({ key: x.id, name: x.name, meta: personaDef(x.role).label + (x.teamId ? ' · ' + teamOf(d, x.teamId).name : ''), tint: x.role === 'member' || x.role === 'captain' ? teamOf(d, x.teamId).color : '#26404d', student: x.role === 'member' || x.role === 'captain' }))
        .filter((x) => !needle || x.name.toLowerCase().includes(needle))
        .slice(0, 60);
    }
    const crew = d.huddle.crew.map((c) => ({ key: c.name, name: c.name, meta: c.job || 'Volunteer', tint: '#26404d', student: false }));
    const kids = d.roster.map((r) => ({ key: r.name, name: r.name, meta: teamOf(d, r.team).name + ' · Grade ' + r.grade + (r.captain ? ' · captain' : ''), tint: teamOf(d, r.team).color, student: true }));
    return [...crew, ...kids].filter((x) => !needle || x.name.toLowerCase().includes(needle)).slice(0, 40);
  }, [d, m, q]);
  const start = (x: (typeof people)[number]) => {
    let id: string;
    if (m.mode === 'supabase') {
      id = dmThreadId(m.membershipId!, x.key);
      if (!d.chatThreads.some((t) => t.id === id)) {
        const t = dmThread(id, d.chatDirectory ?? [], m);
        if (t) api().mutate((y) => void y.chatThreads.push(t));
      }
    } else {
      id = 'dm-' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!d.chatThreads.some((t) => t.id === id)) {
        const staff = ['leader', 'owner', 'scorekeeper', 'coach'] as const;
        api().mutate((y) => {
          y.chatThreads.push({ id, kind: 'dm', name: x.name, sub: x.meta + (x.student ? ' · open door' : ''), tint: x.tint, read: [...staff], post: [...staff] });
          if (x.student) (y.chatMsgs[id] ??= []).push({ id: id + '-door', day: 'Today', time: '', system: true, text: 'Open door: every leader can read this thread.' });
        });
      }
    }
    onClose();
    router.push('/dashboard/chat?t=' + encodeURIComponent(id));
  };
  return (
    <Sheet open={open} onClose={onClose} label="New message" maxH="78%">
      <div className="text-[16px] font-medium leading-[1.2] text-neutral-100">New message</div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search by name" className="input" />
      <div className="text-[11px] leading-[1.45] text-neutral-500 text-pretty">Messages with a student are open door: every leader can read them. Students can’t message each other.</div>
      <div className="flex flex-col">
        {people.map((x) => (
          <button key={x.key} onClick={() => start(x)} className="flex min-h-[52px] w-full items-center gap-[10px] border-t border-divider px-1 py-[9px] text-left first:border-t-0">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11px] font-semibold leading-none text-neutral-100" style={{ background: 'color-mix(in srgb, ' + x.tint + ' 60%, var(--color-neutral-900))' }}>
              {initialsOf(x.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium leading-[1.2] text-neutral-200">{x.name}</div>
              <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{x.meta}</div>
            </div>
            <Icon name="ph ph-caret-right" className="text-[12px] text-neutral-600" />
          </button>
        ))}
        {!people.length ? <div className="px-[6px] py-[26px] text-center text-[11.5px] leading-[1.6] text-neutral-500">Nobody by that name.</div> : null}
      </div>
    </Sheet>
  );
}
