'use client';
/* A student's phone during ministry time. It follows the room: nothing to
   do until a leader opens an activity, then one big way to answer. Answers
   can change until time is up; a word goes to a leader before the screen. */
import { useEffect, useRef, useState } from 'react';
import { readNick, saveNick, useLiveStudent } from '@/components/live/use-live';
import { Btn, Icon, cx } from '@/components/ui';
import { liveType, type LiveAnswer, type RoomActivity } from '@/lib/live';
import { useAppApi } from '@/lib/store/provider';

/** `preview` is a leader looking at what a phone shows: no nickname step,
 *  and outside the demo nothing it sends is counted. */
export function StudentLive({ night, scanned, preview }: { night: string; scanned?: boolean; preview?: boolean }) {
  const s = useLiveStudent(night, preview);
  const api = useAppApi();
  const [nick, setNick] = useState(() => readNick(s.m.firstName));
  const [named, setNamed] = useState(!!preview);
  const room = s.room;
  const checked = useRef(false);

  /* Scanning the room's code checks the student in, once, if the night says so. */
  useEffect(() => {
    if (!scanned || checked.current || !room || room.settings.checkin !== 'on') return;
    checked.current = true;
    if (api().selfCheckIn()) api().say('Checked in for tonight.');
  }, [scanned, room, api]);

  if (!s.ready) return <Waiting icon="ph-circle-notch" title="Joining…" sub="" spin />;
  if (!preview && !s.m.studentName && s.m.mode === 'supabase') return <Waiting icon="ph-user-circle" title="This is for students" sub="Leaders run ministry time from the console." />;
  if (!room) return <Waiting icon="ph-broadcast" title="Nothing live right now" sub="When your leader starts ministry time, it shows up here." />;
  if (room.settings.names === 'nickname' && !named)
    return (
      <div className="sr-card flex flex-col gap-4 px-5 py-6">
        <div className="text-[20px] font-medium text-neutral-100">What should the screen call you?</div>
        <div className="text-[13px] leading-[1.5] text-neutral-400">A first name or a nickname. Never a last name — keep it kind; leaders can see who’s who.</div>
        <input className="input text-[17px]" maxLength={16} value={nick} onChange={(e) => setNick(e.target.value)} aria-label="Nickname" />
        <Btn
          className="min-h-[52px] justify-center text-[15px]"
          disabled={!nick.trim()}
          onClick={() => {
            saveNick(nick.trim());
            setNamed(true);
          }}
        >
          I’m in
        </Btn>
      </div>
    );
  const shownName = room.settings.names === 'first' ? s.m.firstName : nick.trim() || s.m.firstName;
  const act = room.act;
  if (room.ended)
    return (
      <Waiting icon="ph-confetti" title="That’s ministry time" sub={myRank(room.board, shownName) ?? 'Thanks for jumping in.'} />
    );
  if (!act || room.view === 'join' || room.view === 'blank') return <Waiting icon="ph-eye" title={'You’re in, ' + shownName + '.'} sub="Watch the screen. Your phone wakes up when it starts." />;
  const mine = s.mine(act.id);
  const isOpen = room.open === act.id;
  const left = room.endsAt ? Math.max(0, Math.ceil((room.endsAt - s.now) / 1000)) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[12px] text-neutral-400">
        <Icon name={'ph ' + liveType(act.type).icon} className="text-[14px] text-accent-300" />
        <span className="flex-1">
          {liveType(act.type).label} · {room.idx + 1} of {room.total}
        </span>
        {isOpen && left !== null ? <span className={cx('tabular-nums font-semibold', left <= 5 ? 'text-[oklch(0.8_0.09_24)]' : 'text-neutral-100')}>{left}s</span> : null}
        {!isOpen ? <span className="rounded-full bg-neutral-800 px-2 py-[2px]">{room.revealed ? 'Answer' : mine ? 'Locked in' : 'Not open yet'}</span> : null}
      </div>
      <div className="text-[22px] font-medium leading-[1.25] text-neutral-100 text-pretty">{act.prompt}</div>
      {act.type === 'trivia' || act.type === 'this' ? <ChoicePad key={act.id} act={act} mine={mine} open={isOpen} revealed={room.revealed} correct={room.results?.kind === 'choice' ? room.results.correct : null} onPick={(i) => s.send(nick, { choice: i })} /> : null}
      {act.type === 'cloud' ? <WordPad key={act.id} mine={mine} open={isOpen} onSend={(w) => s.send(nick, { word: w })} /> : null}
      {act.type === 'verse' ? <VersePad key={act.id} act={act} mine={mine} open={isOpen} onSend={(b) => s.send(nick, { blanks: b })} /> : null}
      {act.type === 'tug' ? <TugPad key={act.id} act={act} side={s.side} mine={mine} open={isOpen} onTaps={(n) => s.send(nick, { taps: n })} /> : null}
      {s.failed === act.id ? <div className="text-[12.5px] text-[oklch(0.8_0.09_24)]">That one didn’t land — time may be up.</div> : null}
    </div>
  );
}

function myRank(board: { name: string; pts: number }[], name: string) {
  const i = board.findIndex((b) => b.name === name);
  return i < 0 ? null : 'You finished ' + ordinal(i + 1) + ' of ' + board.length + ' with ' + board[i].pts.toLocaleString('en-US') + ' points.';
}
const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10] ?? 'th');

function Waiting({ icon, title, sub, spin }: { icon: string; title: string; sub: string; spin?: boolean }) {
  return (
    <div className="sr-card flex flex-col items-center gap-3 px-5 py-10 text-center">
      <Icon name={'ph ' + icon} className={cx('text-[38px] text-accent-300', spin && 'animate-spin')} />
      <div className="text-[19px] font-medium text-neutral-100">{title}</div>
      {sub ? <div className="max-w-[300px] text-[13px] leading-[1.5] text-neutral-400 text-pretty">{sub}</div> : null}
    </div>
  );
}

function ChoicePad({ act, mine, open, revealed, correct, onPick }: { act: RoomActivity; mine: LiveAnswer | null; open: boolean; revealed: boolean; correct: number | null; onPick: (i: number) => void }) {
  const pick = mine && 'choice' in mine.value ? mine.value.choice : null;
  return (
    <div className="flex flex-col gap-3">
      {(act.options ?? []).map((o, i) => {
        const on = pick === i;
        const right = revealed && correct === i;
        return (
          <button
            key={i}
            disabled={!open}
            onClick={() => onPick(i)}
            aria-pressed={on}
            className="flex min-h-[60px] items-center gap-3 rounded-xl border-2 px-4 text-left text-[17px] font-medium disabled:cursor-default"
            style={{ borderColor: right ? 'var(--color-accent-300)' : on ? 'var(--color-accent)' : 'var(--color-neutral-800)', background: on ? 'var(--color-accent-900)' : 'var(--color-surface)', color: 'var(--color-neutral-100)', opacity: !open && !on && !right ? 0.6 : 1 }}
          >
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2" style={{ borderColor: on ? 'var(--color-accent)' : 'var(--color-neutral-600)' }}>
              {on ? <span className="h-[10px] w-[10px] rounded-full bg-accent-500" /> : null}
            </span>
            <span className="flex-1">{o}</span>
            <span className="text-[12px] font-normal text-neutral-400">{revealed && correct !== null ? (right ? (on ? 'Correct' : 'Answer') : on ? 'Not this one' : '') : on ? 'Your answer' : ''}</span>
          </button>
        );
      })}
      {open && pick !== null ? <div className="text-[12.5px] text-neutral-500">You can change it until time’s up.</div> : null}
    </div>
  );
}

function WordPad({ mine, open, onSend }: { mine: LiveAnswer | null; open: boolean; onSend: (w: string) => void }) {
  const [w, setW] = useState('');
  const sent = mine && 'word' in mine.value ? mine.value.word : null;
  return (
    <div className="flex flex-col gap-3">
      {sent ? (
        <div className="rounded-xl border border-neutral-800 bg-surface px-4 py-3 text-[14px] text-neutral-300">
          You sent <span className="font-medium text-neutral-100">“{sent}”</span>. A leader lets words through to the screen.
        </div>
      ) : null}
      {open ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const word = w.trim().split(/\s+/).slice(0, 2).join(' ');
            if (!word) return;
            onSend(word);
            setW('');
          }}
        >
          <input className="input flex-1 text-[17px]" maxLength={24} placeholder={sent ? 'Change your word' : 'One word'} value={w} onChange={(e) => setW(e.target.value)} aria-label="Your word" />
          <Btn className="px-5" disabled={!w.trim()}>
            Send
          </Btn>
        </form>
      ) : !sent ? (
        <div className="text-[13px] text-neutral-500">Not open yet.</div>
      ) : null}
    </div>
  );
}

function VersePad({ act, mine, open, onSend }: { act: RoomActivity; mine: LiveAnswer | null; open: boolean; onSend: (b: string[]) => void }) {
  const parts = act.verse ?? [];
  const n = parts.filter((p) => p.blank).length;
  const sent = mine && 'blanks' in mine.value ? mine.value.blanks : null;
  const [vals, setVals] = useState<string[]>(() => sent ?? Array.from({ length: n }, () => ''));
  let k = -1;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSend(vals.map((v) => v.trim()));
      }}
    >
      <div className="text-[17px] leading-[2.1] text-neutral-300">
        {parts.map((p, i) => {
          if (!p.blank) return <span key={i}>{p.t}</span>;
          k++;
          const j = k;
          return open ? (
            <input
              key={i}
              className="mx-1 w-[120px] border-b-2 border-accent-500 bg-transparent px-1 text-center text-[17px] text-accent-100 outline-none"
              value={vals[j] ?? ''}
              onChange={(e) => setVals((v) => v.map((x, y) => (y === j ? e.target.value : x)))}
              aria-label={'Blank ' + (j + 1)}
            />
          ) : (
            <span key={i} className="mx-1 border-b-2 border-accent-500 px-1 font-medium text-accent-200">
              {/^_+$/.test(p.t) ? sent?.[j] || '  ' : p.t}
            </span>
          );
        })}
      </div>
      {open ? (
        <Btn className="min-h-[50px] justify-center" disabled={vals.every((v) => !v.trim())}>
          {sent ? 'Update' : 'Send'}
        </Btn>
      ) : null}
      {sent && open ? <div className="text-[12.5px] text-neutral-500">Sent. You can change it until time’s up.</div> : null}
    </form>
  );
}

function TugPad({ act, side, mine, open, onTaps }: { act: RoomActivity; side: 0 | 1; mine: LiveAnswer | null; open: boolean; onTaps: (n: number) => void }) {
  const base = mine && 'taps' in mine.value ? mine.value.taps : 0;
  const [taps, setTaps] = useState(base);
  const latest = useRef({ taps: base, sent: base, onTaps });
  useEffect(() => {
    latest.current.taps = taps;
    latest.current.onTaps = onTaps;
  });
  /* Taps go up in batches, not one write per tap. */
  useEffect(() => {
    if (!open) return;
    const flush = () => {
      const l = latest.current;
      if (l.taps === l.sent) return;
      l.sent = l.taps;
      l.onTaps(l.taps);
    };
    const t = window.setInterval(flush, 450);
    return () => {
      window.clearInterval(t);
      flush();
    };
  }, [open]);
  const sides = act.sides ?? ['Left side', 'Right side'];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-[14px] text-neutral-400">
        You pull for <span className="font-medium text-neutral-100">{sides[side]}</span>
      </div>
      <button
        disabled={!open}
        onPointerDown={(e) => {
          e.preventDefault();
          setTaps((n) => n + 1);
        }}
        className="flex h-[200px] w-[200px] select-none items-center justify-center rounded-full text-[28px] font-semibold text-white active:scale-95 disabled:opacity-40"
        style={{ background: side === 0 ? 'oklch(0.63 0.1 292)' : 'oklch(0.63 0.1 208)', touchAction: 'manipulation' }}
      >
        PULL
      </button>
      <div className="tabular-nums text-[15px] text-neutral-300">{taps} taps</div>
    </div>
  );
}
