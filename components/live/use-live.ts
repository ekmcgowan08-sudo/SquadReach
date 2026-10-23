'use client';
/* Live ministry time on the client. useLive follows one night's room and
   answers; useLiveConsole is the leader's side — it tallies, scores and
   writes the room snapshot everyone else reads; useLiveStudent answers. */
import { useEffect, useRef, useState } from 'react';
import { LIVE_DEFAULTS, emptyRoom, leaderboard, pendingWords, pickRoom, publicResults, roomActivity, sideFor, sidesFor, simulatedAnswers, summaryLine, tally, timerOf, type LiveActivity, type LiveAnswer, type LiveRoom, type LiveValue, type RoomView } from '@/lib/live';
import { nowMs } from '@/lib/dates';
import type { Plan } from '@/lib/plan';
import { useApp, useAppApi } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';

export function useLive(night: string) {
  const backend = useApp((s) => s.backend);
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    void backend.live.load(night).then((r) => {
      if (!on) return;
      setRoom(r.room);
      setAnswers(r.answers);
      setReady(true);
    });
    const off = backend.live.subscribe(night, (p) => {
      if (p.room) setRoom(p.room);
      if (p.cleared) setAnswers([]);
      const a = p.answer;
      if (a) setAnswers((xs) => [...xs.filter((x) => !(x.act === a.act && x.member === a.member)), a]);
    });
    return () => {
      on = false;
      off();
    };
  }, [backend, night]);
  return { room, answers, ready, setRoom, setAnswers, backend };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Change one night's live record in the plan (leaders only). */
export function useLiveSave(night: string) {
  const api = useAppApi();
  return (recipe: (live: NonNullable<Plan['gatherings'][string]['live']>, p: Plan) => void) => {
    api().mutate((x) => {
      const g = (x.plan.gatherings[night] ??= {});
      g.live ??= { acts: [] };
      recipe(g.live, x.plan);
    });
    api().emit({ kind: 'doc', key: 'plan', value: api().data.plan });
  };
}

export function useLiveConsole(night: string) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const live = useLive(night);
  const save = useLiveSave(night);
  const now = useNow(true, 1000);
  const p = d.plan;
  const settings = { ...LIVE_DEFAULTS, ...p.live };
  const rec = p.gatherings[night]?.live;
  const acts = rec?.acts ?? [];
  const decided = rec?.decided ?? {};
  const squads = d.teams;
  const grades = [...new Set(d.roster.map((r) => r.grade).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
  const sides = sidesFor(settings.teams, squads, grades);
  const room = live.room ?? emptyRoom(night, acts.length, settings, 0);

  /* Demo: the room answers too, arriving across each timer. */
  const crowd = d.roster.filter((r) => !r.guest && r.name !== m.studentName).map((r) => r.name);
  const all = m.mode !== 'demo' ? live.answers : [...live.answers, ...acts.flatMap((a) => (room.opened[a.id] !== undefined ? simulatedAnswers(a, room.opened[a.id], room.closed[a.id] ?? null, now, crowd, settings) : []))];

  const cur: LiveActivity | undefined = acts[room.idx];
  const results = cur ? tally(cur, all, settings, sides, decided) : null;
  const board = leaderboard(acts, all, room.opened, settings);
  const answered = cur ? new Set(all.filter((a) => a.act === cur.id).map((a) => a.member)).size : 0;
  const pending = cur?.type === 'cloud' && settings.approve === 'on' ? pendingWords(all, cur.id, decided) : [];

  const write = (next: LiveRoom) => {
    const r = { ...next, total: acts.length, settings: pickRoom(settings), at: nowMs() };
    live.setRoom(r);
    void live.backend.live.room(night, r).catch(() => api().say('The room didn’t get that — check the connection.'));
  };

  /* Keep the room's public results in step with the answers. */
  const shown = publicResults(results, room.revealed, settings, room.view);
  const pub = { results: shown, answered, board: board.slice(0, 50) };
  const last = useRef('');
  useEffect(() => {
    if (!live.ready || !live.room || !room.started) return;
    const key = JSON.stringify(pub);
    if (key === last.current || sameJson({ results: room.results, answered: room.answered, board: room.board }, pub)) return;
    last.current = key;
    const t = window.setTimeout(() => write({ ...room, ...pub }), 600);
    return () => window.clearTimeout(t);
  });

  const go = (i: number) => {
    const a = acts[i];
    if (!a) return;
    write({ ...room, idx: i, act: roomActivity(a, settings, sides, false), open: null, openedAt: null, endsAt: null, revealed: false, results: null, answered: 0, view: room.started ? 'activity' : room.view });
  };
  const open = () => {
    if (!cur) return;
    const t = nowMs();
    const secs = timerOf(cur, settings);
    write({ ...room, act: roomActivity(cur, settings, sides, false), open: cur.id, openedAt: t, endsAt: secs ? t + secs * 1000 : null, revealed: false, view: 'activity', opened: { ...room.opened, [cur.id]: room.opened[cur.id] ?? t }, started: true, ended: false });
  };
  const close = () => {
    if (!room.open) return;
    write({ ...room, open: null, endsAt: null, closed: { ...room.closed, [room.open]: nowMs() } });
  };
  /* The timer runs out on its own. */
  useEffect(() => {
    if (room.open && room.endsAt && now >= room.endsAt) close();
  });
  const reveal = () => cur && write({ ...room, open: null, endsAt: null, closed: room.open ? { ...room.closed, [room.open]: nowMs() } : room.closed, revealed: true, act: roomActivity(cur, settings, sides, true), results, view: 'activity' });
  const view = (v: RoomView) => write({ ...room, view: v });
  const decide = (word: string, ok: boolean) => save((l) => void (l.decided = { ...l.decided, [word]: ok }));
  const restart = async () => {
    await live.backend.live.clear(night);
    live.setAnswers([]);
    write(emptyRoom(night, acts.length, settings, nowMs()));
  };
  const end = () => write({ ...room, open: null, endsAt: null, ended: true, view: 'board' });
  const lines = acts.filter((a) => room.opened[a.id] !== undefined).map((a) => ({ id: a.id, type: a.type, prompt: a.prompt, line: summaryLine(a, tally(a, all, settings, sides, decided)) }));
  const attach = () => {
    save((l) => void (l.results = { at: nowMs(), by: m.displayName, lines }));
    api().say('Attached to the night’s debrief.');
  };
  return { d, m, now, settings, acts, room, cur, results, board, answered, pending, sides, lines, attached: rec?.results ?? null, all, go, open, close, reveal, view, decide, restart, end, attach, ready: live.ready };
}

const NICK_KEY = 'squadrise_live_nick';
export function readNick(fallback: string) {
  try {
    return localStorage.getItem(NICK_KEY) || fallback;
  } catch {
    return fallback;
  }
}
export function saveNick(nick: string) {
  try {
    localStorage.setItem(NICK_KEY, nick);
  } catch {
    /* fine for tonight */
  }
}

export function useLiveStudent(night: string, preview?: boolean) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const live = useLive(night);
  const now = useNow(true, 500);
  const me = m.membershipId ?? 'demo-' + m.persona;
  const kid = d.roster.find((r) => r.name === m.studentName);
  const grades = [...new Set(d.roster.map((r) => r.grade).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
  const room = live.room;
  const side = sideFor(room?.settings.teams ?? 'auto', { member: me, team: kid?.team ?? m.teamId, grade: kid?.grade ?? '' }, d.teams.map((t) => t.id), grades);
  const mine = (act: string) => live.answers.find((a) => a.act === act && a.member === me) ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  const send = (nick: string, value: LiveValue) => {
    if (!room?.act || room.open !== room.act.id) return;
    if (preview && m.mode !== 'demo') return;
    const a: LiveAnswer = { act: room.act.id, member: me, name: m.firstName, nick, side, at: nowMs(), value };
    live.setAnswers((xs) => [...xs.filter((x) => !(x.act === a.act && x.member === a.member)), a]);
    setFailed(null);
    void live.backend.live.answer(night, a).catch(() => setFailed(a.act));
  };
  return { d, m, room, now, me, side, mine, send, failed, ready: live.ready };
}
