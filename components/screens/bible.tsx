'use client';
/* BIBLE & MEMORY — the week's verse, six ways to drill it, and one tap to log
   that you practiced. Leaders see that you showed up and did the work; they
   never see a score, and nothing here touches the ledger. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader, initialsOf, tint } from '@/components/ui';
import {
  BOOKS, LANGS, LICENSE_STATUS, READER_TRANSLATIONS, bibleStats, blankIdxs, drillsIn, fetchChapter, firstLetters, markAttempt, markSpoken, norm, shuffled,
  verseForWeek, words, type ChapterVerse, type DrillId, type LangId
} from '@/lib/bible';
import { isoDay } from '@/lib/dates';
import { holdsSheet } from '@/lib/permissions';
import { myBible, myTeamId, practiceName, teamOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { PracticeRow } from '@/lib/types/model';

type Mode = DrillId;

/* The verse card runs a touch brighter than the page, as the design has it. */
const CARD_VARS = {
  '--color-neutral-100': '#f3f5fe', '--color-neutral-200': '#e4e7f5', '--color-neutral-300': '#cfd3e5', '--color-neutral-400': '#b2b6ca',
  '--color-neutral-500': '#9397ab', '--color-neutral-600': '#75798c', '--color-accent-100': '#f5f4ff', '--color-accent-200': '#e7e5fe',
  '--color-accent-300': '#d2cefd', '--color-accent-400': '#b5abfc', '--color-accent-500': '#968ae0', '--color-accent-600': '#796cbf', '--color-accent-700': '#5d5294'
} as CSSProperties;

const pill = (on: boolean): CSSProperties => ({
  borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
});

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

export function BibleScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const [lang, setLang] = useState<LangId>('en');
  const [version, setVersion] = useState<string>('KJV');
  const [menu, setMenu] = useState(false);
  const [modePick, setMode] = useState<Mode>('flashcard');
  const [hidden, setHidden] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [blanks, setBlanks] = useState<Record<number, string>>({});
  const [blankChecked, setBlankChecked] = useState(false);
  const [typed, setTyped] = useState('');
  const [typeResult, setTypeResult] = useState<ReturnType<typeof markAttempt> | null>(null);
  const [sayState, setSayState] = useState<'idle' | 'listening' | 'done' | 'unsupported'>('idle');
  const [heard, setHeard] = useState('');
  const [bag, setBag] = useState<{ w: string; i: number }[]>([]);
  const [picked, setPicked] = useState<{ w: string; i: number }[]>([]);
  const [browse, setBrowse] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  const verse = verseForWeek(d.config.memoryVerses, d.config.weekNumber);
  const text = verse?.text[version] ?? null;
  const shown = text ?? 'This translation needs a licensed Bible content source to display verse text — pick KJV, ASV or RVR1909 to try the drills now.';
  const arr = words(shown);
  const blankSet = new Set(blankIdxs(shown));
  const stats = myBible(d, m);
  /* Only the drills the ministry runs this week; a pick that was switched off falls back to the first. */
  const modes = drillsIn(d.config.drillWeeks, d.config.weekNumber);
  const mode: Mode = modes.some((x) => x.id === modePick) ? modePick : modes[0].id;

  const reset = () => {
    setHidden([]);
    setRevealed(false);
    setBlanks({});
    setBlankChecked(false);
    setTyped('');
    setTypeResult(null);
    setSayState('idle');
    setHeard('');
    setPicked([]);
    recRef.current?.stop();
  };
  const pickMode = (id: Mode) => {
    reset();
    setMode(id);
    setBag(id === 'scramble' ? shuffled(arr.map((w, i) => ({ w, i }))) : []);
  };
  const pickVersion = (l: LangId, v: string) => {
    reset();
    setLang(l);
    setVersion(v);
    setMenu(false);
    if (mode === 'scramble') setBag(shuffled(words(verse?.text[v] ?? '').map((w, i) => ({ w, i }))));
  };
  useEffect(() => () => recRef.current?.stop(), []);

  const say = () => {
    if (sayState === 'listening') {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setSayState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang === 'es' ? 'es-ES' : 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    let last = '';
    rec.onresult = (e) => {
      last = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ');
      setHeard(last);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') api().say('Microphone is blocked — allow it in your browser settings to recite.');
    };
    rec.onend = () => {
      setSayState('done');
      if (last && text) {
        const r = markSpoken(text, last);
        api().say(r.right === r.total ? 'Word for word. Nice recitation.' : r.right + ' of ' + r.total + ' words — run it again.');
      }
    };
    recRef.current = rec;
    setHeard('');
    setSayState('listening');
    rec.start();
  };

  const complete = () => {
    if (stats.loggedToday) {
      api().say('Already logged today. Come back tomorrow to keep the streak.');
      return;
    }
    const now = new Date();
    const row: PracticeRow = { id: uid(), who: practiceName(m), team: myTeamId(m, d, coachTeam), day: isoDay(now), ref: verse?.ref ?? '', mode, at: now.getTime() };
    api().mutate((x) => {
      x.practiceLog.push(row);
    });
    api().emit({ kind: 'practice', row });
    api().say('+25 XP. Your leaders can see you practiced today.');
  };

  const scrambleTarget = arr.map((w, i) => ({ w, i }));
  const bagShown = bag.length || picked.length ? bag : scrambleTarget;
  const scrambleDone = picked.length > 0 && bagShown.length === 0;
  const inOrder = picked.length === arr.length && picked.every((it, i) => norm(it.w) === norm(arr[i]));

  return (
    <Screen label="Bible & memory">
      <ScreenHeader
        title="Bible & Memory"
        back="/dashboard/more"
        right={
          <button onClick={() => setBrowse(true)} className="min-h-11 rounded-full border border-accent-600 px-3 text-[11.5px] font-medium leading-none text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
            Browse full Bible
          </button>
        }
      />

      <div className="flex items-center gap-[10px]">
        {[
          { v: stats.streak + ' days', l: 'Day streak', accent: true },
          { v: stats.xp + ' XP', l: 'XP earned' },
          { v: stats.due + ' verses', l: 'Due for review' }
        ].map((x) => (
          <div key={x.l} className="sr-card flex-1 px-[13px] py-[10px] text-center">
            <div className="text-[18px] font-semibold leading-none" style={{ color: x.accent ? 'var(--color-accent-300)' : 'var(--color-neutral-100)' }}>
              {x.v}
            </div>
            <div className="mt-1 text-[9.5px] leading-none text-neutral-500">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-[6px]">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => pickVersion(l.id, l.versions[0])} aria-pressed={lang === l.id} className="min-h-11 rounded-full border px-3 text-[11.5px] font-medium leading-none" style={pill(lang === l.id)}>
            {l.label}
          </button>
        ))}
        <span className="mx-[2px] my-1 w-px bg-divider" />
        <div className="relative inline-flex">
          <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} className="flex min-h-11 items-center gap-[6px] rounded-full border border-neutral-700 bg-transparent px-3 text-[11.5px] font-medium leading-none text-neutral-200">
            {version}
            <Icon name="ph ph-caret-down" className="text-[10px]" />
          </button>
          {menu ? (
            <div className="absolute left-0 top-[46px] z-20 min-w-[190px] overflow-hidden rounded-md border border-neutral-800 bg-surface" style={{ boxShadow: 'var(--shadow-md)' }}>
              {(LANGS.find((l) => l.id === lang) ?? LANGS[0]).versions.map((v) => (
                <button
                  key={v}
                  onClick={() => pickVersion(lang, v)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[11.5px] font-medium leading-none"
                  style={{ background: v === version ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: v === version ? 'var(--color-accent-200)' : 'var(--color-neutral-300)' }}
                >
                  <span className="flex-1">{v}</span>
                  <span className="text-[9.5px] font-normal text-neutral-500">{LICENSE_STATUS[v]}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-[6px]">
        {modes.map((x) => (
          <button key={x.id} onClick={() => pickMode(x.id)} aria-pressed={mode === x.id} className="min-h-11 rounded-md border px-3 text-[11.5px] font-medium leading-[1.2]" style={pill(mode === x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {!text ? (
        <div className="rounded-md border border-accent-700 px-3 py-[10px] text-[11px] leading-[1.5] text-accent-200 text-pretty" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
          This translation needs a licensed Bible content source — pick KJV, ASV or RVR1909 above to try the drills now.
        </div>
      ) : null}

      <div className="sr-dark rounded-lg px-4 pb-[15px] pt-4" style={{ ...CARD_VARS, background: 'linear-gradient(165deg, var(--color-section), #1c1f3f)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="mb-[11px] flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">
            Week {d.config.weekNumber} · {verse?.ref ?? 'No verse set'}
          </span>
          <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--color-accent-700), transparent)' }} />
        </div>

        {mode === 'flashcard' ? (
          <>
            <div className="flex flex-wrap gap-x-[7px] gap-y-[9px]">
              {arr.map((w, i) => {
                const off = hidden.includes(i);
                return (
                  <button
                    key={i}
                    data-drill-word
                    onClick={() => setHidden((h) => (off ? h.filter((x) => x !== i) : h.concat(i)))}
                    className="rounded-[5px] px-[9px] py-2 text-[15.5px] leading-[1.35]"
                    style={{ background: off ? 'var(--color-accent-900)' : 'transparent', color: off ? 'var(--color-accent-400)' : 'var(--color-neutral-100)' }}
                  >
                    {off ? w.replace(/[\p{L}']/gu, '·') : w}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-[7px]">
              <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setHidden(arr.map((_, i) => i))}>
                Hide all
              </Btn>
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setHidden([])}>
                Reset
              </Btn>
            </div>
            <div className="mt-3 text-[10.5px] leading-[1.4] text-accent-300">{hidden.length ? hidden.length + ' words hidden — tap one to bring it back.' : 'Tap any word to hide it, or hide the whole verse to self-test.'}</div>
          </>
        ) : null}

        {mode === 'firstletter' ? (
          <>
            <div className="text-center text-[15.5px] font-medium leading-[1.6] tracking-[.02em] text-neutral-100">{revealed ? shown : firstLetters(shown)}</div>
            <Btn variant="secondary" className="mt-[13px] w-full justify-center" onClick={() => setRevealed((v) => !v)}>
              {revealed ? 'Hide verse' : 'Reveal full verse'}
            </Btn>
            <div className="mt-[10px] text-[10.5px] leading-[1.4] text-accent-300">Recite from the first letters — the strongest recall cue once you’re close to mastery.</div>
          </>
        ) : null}

        {mode === 'blank' ? (
          <>
            <div className="flex flex-wrap items-center gap-x-[7px] gap-y-[6px]">
              {arr.map((w, i) =>
                blankSet.has(i) ? (
                  <input
                    key={i}
                    value={blanks[i] ?? ''}
                    onChange={(e) => {
                      setBlanks((b) => ({ ...b, [i]: e.target.value }));
                      setBlankChecked(false);
                    }}
                    placeholder="…"
                    aria-label={'Word ' + (i + 1)}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="min-h-11 w-16 rounded-[6px] border px-2 text-center text-[13px] font-medium leading-none text-accent-100"
                    style={{ background: 'rgba(0,0,0,.28)', borderColor: blankChecked ? (norm(blanks[i] ?? '') === norm(w) ? 'var(--color-accent-500)' : '#a24d4d') : 'var(--color-accent-700)' }}
                  />
                ) : (
                  <span key={i} className="px-[2px] py-[3px] text-[15.5px] leading-[1.35] text-neutral-100">
                    {w}
                  </span>
                )
              )}
            </div>
            <Btn
              className="mt-[13px] w-full justify-center"
              onClick={() => {
                setBlankChecked(true);
                const idx = [...blankSet];
                const right = idx.filter((i) => norm(blanks[i] ?? '') === norm(arr[i])).length;
                api().say(right + ' of ' + idx.length + ' blanks correct.');
              }}
            >
              Check blanks
            </Btn>
          </>
        ) : null}

        {mode === 'type' ? (
          <>
            <textarea
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setTypeResult(null);
              }}
              placeholder="Type the whole verse from memory…"
              aria-label="Type the verse"
              className="input !min-h-24 w-full resize-none text-[13.5px] leading-[1.5]"
            />
            <Btn className="mt-[10px] w-full justify-center" onClick={() => setTypeResult(markAttempt(shown, typed))}>
              Check
            </Btn>
            {typeResult ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-[5px]">
                  {arr.map((w, i) => (
                    <span key={i} className="rounded-[4px] px-[3px] py-[2px] text-[13.5px] font-medium leading-[1.4]" style={{ color: typeResult.marks[i] ? 'var(--color-accent-300)' : '#c98686' }}>
                      {w}
                    </span>
                  ))}
                </div>
                <div className="mt-[9px] text-[11.5px] font-medium leading-none text-accent-300">
                  {typeResult.right} / {typeResult.total} words right
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {mode === 'say' ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              aria-label={sayState === 'listening' ? 'Stop listening' : 'Tap to recite'}
              onClick={say}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border border-accent-500 text-accent-100"
              style={{ background: 'radial-gradient(120% 120% at 50% 0%, var(--color-accent-700), var(--color-accent-900))', animation: sayState === 'listening' ? 'sr-pulse 1.4s ease-in-out infinite' : undefined }}
            >
              <Icon name="ph-fill ph-microphone" className="text-[26px]" />
            </button>
            <div className="text-[12.5px] font-medium leading-none text-accent-200">{sayState === 'listening' ? 'Listening… tap to stop' : sayState === 'done' ? 'Recite again' : 'Tap to recite'}</div>
            {sayState === 'unsupported' ? <div className="text-center text-[11px] leading-[1.5] text-neutral-400 text-pretty">This browser can’t listen. Say it out loud to a friend or a coach — or try Type from Memory.</div> : null}
            {heard ? (
              <div className="text-center text-[13.5px] leading-[1.6] text-neutral-200 text-pretty">
                “{heard}”
                {sayState === 'done' && text ? (
                  <div className="mt-2 text-[11.5px] font-medium text-accent-300">
                    {markSpoken(text, heard).right} / {arr.length} words matched
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'scramble' ? (
          <>
            <div className="flex min-h-[60px] flex-wrap items-start gap-[6px] rounded-md p-[9px]" style={{ background: 'rgba(0,0,0,.22)' }}>
              {picked.map((it) => (
                <button
                  key={it.i}
                  onClick={() => {
                    setPicked((p) => p.filter((x) => x.i !== it.i));
                    setBag((b) => (b.length || picked.length ? b : scrambleTarget).concat(it));
                  }}
                  className="rounded-[6px] border border-accent-600 px-[9px] py-[5px] text-[13.5px] font-medium leading-[1.2] text-accent-100"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)' }}
                >
                  {it.w}
                </button>
              ))}
            </div>
            <div className="mt-[11px] flex flex-wrap gap-[6px]">
              {bagShown.map((it) => (
                <button
                  key={it.i}
                  onClick={() => {
                    setBag(bagShown.filter((x) => x.i !== it.i));
                    setPicked((p) => p.concat(it));
                  }}
                  className="rounded-[6px] border border-neutral-700 bg-neutral-900 px-[9px] py-[5px] text-[13.5px] font-medium leading-[1.2] text-neutral-200"
                >
                  {it.w}
                </button>
              ))}
            </div>
            <div className="mt-[13px] flex items-center gap-[10px]">
              <Btn
                variant="secondary"
                onClick={() => {
                  setPicked([]);
                  setBag(shuffled(scrambleTarget));
                }}
              >
                Reshuffle
              </Btn>
              {scrambleDone ? <span className="text-[12px] font-medium leading-none text-accent-300">{inOrder ? 'In order ✓' : 'Not quite — tap a word to send it back'}</span> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="sr-card px-[15px] pb-[15px] pt-[14px]">
        <div className="text-[13.5px] font-medium leading-none text-neutral-100">Finished this practice?</div>
        <div className="mt-[5px] text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">One tap logs it. Your leaders see that you showed up and did the work — they don’t see a score.</div>
        <button
          onClick={complete}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-[9px] rounded-md border text-[13.5px] font-semibold leading-none"
          style={{
            borderColor: stats.loggedToday ? 'var(--color-neutral-800)' : 'var(--color-accent-500)',
            background: stats.loggedToday ? 'transparent' : 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
            color: stats.loggedToday ? 'var(--color-neutral-500)' : 'var(--color-accent-100)'
          }}
        >
          <Icon name={stats.loggedToday ? 'ph-fill ph-check-circle' : 'ph ph-check-circle'} className="text-[17px]" />
          {stats.loggedToday ? 'Practice logged today ✓' : 'Complete this practice'}
        </button>
        <div className="mt-3 flex items-center gap-2 border-t border-divider pt-3">
          <Icon name="ph ph-paper-plane-tilt" className="flex-none text-[14px] text-neutral-500" />
          <div className="text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">Goes to your youth pastor, admins, scorekeeper, coaches and captain · +1 streak per logged practice, once a day</div>
        </div>
      </div>

      <Practicing />

      <BrowseSheet open={browse} onClose={() => setBrowse(false)} version={version} />
    </Screen>
  );
}

/** Who's actually practicing — staff see everyone, a captain their squad. */
function Practicing() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const staff = holdsSheet(m.persona);
  const captain = m.persona === 'captain';
  const rows = useMemo(() => {
    if (!staff && !captain) return [];
    const byWho = new Map<string, PracticeRow[]>();
    for (const r of d.practiceLog) {
      if (captain && !staff && r.team !== m.teamId) continue;
      byWho.set(r.who, (byWho.get(r.who) ?? []).concat(r));
    }
    const today = isoDay(new Date());
    return [...byWho.entries()]
      .map(([who, list]) => {
        const st = bibleStats(list, d.config.memoryVerses, d.config.weekNumber);
        const team = list[0].team ?? d.roster.find((r) => r.name === who)?.team ?? null;
        const modes = new Set(list.map((r) => r.mode));
        const bits = [st.verses + (st.verses === 1 ? ' verse' : ' verses')];
        if (list.some((r) => r.day === today)) bits.push('practiced today');
        else if (st.streak > 1) bits.push(st.streak + '-day streak');
        if (modes.size === 1 && modes.has('flashcard')) bits.push('flashcards only');
        if (team) bits.push(teamOf(d, team).name);
        return { who, team, count: st.verses, practices: list.length, meta: bits.join(' · ') };
      })
      .sort((a, b) => b.practices - a.practices)
      .slice(0, 8);
  }, [d, m.teamId, staff, captain]);
  if (!staff && !captain) return null;
  return (
    <div className="sr-card overflow-hidden">
      <div className="px-[15px] pb-[11px] pt-[13px] text-[13.5px] font-medium leading-none text-neutral-100">Who’s actually practicing</div>
      {!rows.length ? <div className="border-t border-divider px-[15px] py-3 text-[11.5px] leading-[1.5] text-neutral-500">Nobody has logged a practice in the last few weeks.</div> : null}
      {rows.map((r) => (
        <div key={r.who} className="flex items-center gap-[11px] border-t border-divider px-[15px] py-[11px]">
          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[11px] font-semibold leading-none text-neutral-100" style={{ background: tint(teamOf(d, r.team).color) }}>
            {initialsOf(r.who)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">{r.who}</div>
            <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{r.meta}</div>
          </div>
          <div className="flex-none text-[12px] font-semibold leading-none text-neutral-300">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

function BrowseSheet({ open, onClose, version }: { open: boolean; onClose: () => void; version: string }) {
  const [nt, setNt] = useState(true);
  const [book, setBook] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const readerVersion = READER_TRANSLATIONS[version] ? version : 'KJV';
  const b = BOOKS.find((x) => x.name === book);
  const list = BOOKS.filter((x) => (q.trim() ? x.name.toLowerCase().includes(q.trim().toLowerCase()) : x.nt === nt));

  useEffect(() => {
    if (!book || !chapter) return;
    const ctl = new AbortController();
    fetchChapter(book, chapter, readerVersion, ctl.signal)
      .then((v) => {
        setVerses(v);
        setErr('');
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return;
        setVerses(null);
        setErr(navigator.onLine ? 'The reader didn’t answer. Try again in a moment.' : 'No signal — chapters load when you’re back online.');
      });
    return () => ctl.abort();
  }, [book, chapter, readerVersion]);

  const close = () => {
    onClose();
    setBook(null);
    setChapter(null);
    setVerses(null);
  };

  return (
    <Sheet open={open} onClose={close} label="Browse the Bible" z={85} maxH="85%">
      {book && chapter ? (
        <>
          <div className="flex items-center gap-2">
            <button aria-label="Back to chapters" onClick={() => { setChapter(null); setVerses(null); setErr(''); }} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
              <Icon name="ph ph-caret-left" className="text-[14px]" />
            </button>
            <div className="flex-1 text-[17px] font-medium leading-[1.2] text-neutral-100">
              {book} {chapter}
            </div>
            <span className="text-[10.5px] leading-none text-neutral-500">{readerVersion}</span>
          </div>
          {readerVersion !== version ? <div className="text-[10.5px] leading-[1.5] text-neutral-500">{version} needs a licensed provider to read in full — showing {readerVersion}.</div> : null}
          {err ? <div className="text-[12px] leading-[1.5] text-accent-200">{err}</div> : null}
          {!verses && !err ? <div className="sr-shimmer h-40 rounded-md" /> : null}
          {verses ? (
            <div className="text-[14px] leading-[1.75] text-neutral-200 text-pretty">
              {verses.map((v) => (
                <span key={v.verse}>
                  <sup className="mr-[3px] text-[9.5px] font-semibold text-accent-300">{v.verse}</sup>
                  {v.text}{' '}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => chapter > 1 && setChapter(chapter - 1)}>
              Previous
            </Btn>
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => b && chapter < b.chapters && setChapter(chapter + 1)}>
              Next
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Browse the Bible</div>
          <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Reads the public-domain King James and American Standard text. Licensed translations connect once your ministry links a Bible provider.</div>
          {b ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-accent-300">{b.name}</div>
                <button onClick={() => setBook(null)} className="min-h-11 px-2 text-[11.5px] leading-none text-neutral-400">
                  All books
                </button>
              </div>
              <div className="grid grid-cols-6 gap-[7px]">
                {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => (
                  <button key={c} onClick={() => setChapter(c)} className="flex min-h-11 items-center justify-center rounded-md border border-neutral-800 text-[12.5px] font-medium leading-none text-neutral-300">
                    {c}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a book" aria-label="Find a book" />
              {!q.trim() ? (
                <div className="flex gap-[7px]">
                  {[
                    { on: !nt, label: 'Old Testament', v: false },
                    { on: nt, label: 'New Testament', v: true }
                  ].map((t) => (
                    <button key={t.label} onClick={() => setNt(t.v)} className="min-h-11 flex-1 rounded-md border text-[12px] font-medium leading-none" style={pill(t.on)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-[7px]">
                {list.map((x) => (
                  <button key={x.name} onClick={() => (x.chapters === 1 ? (setBook(x.name), setChapter(1)) : setBook(x.name))} className="min-h-11 rounded-md border border-neutral-800 bg-transparent text-[12.5px] font-medium leading-none text-neutral-300">
                    {x.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <Btn variant="ghost" className="min-h-[46px] justify-center" onClick={close}>
            Close
          </Btn>
        </>
      )}
    </Sheet>
  );
}
