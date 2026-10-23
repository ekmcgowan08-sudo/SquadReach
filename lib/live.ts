/* Live ministry time: short activities run from the leader's phone during
   the ministry-time block, answered on students' phones, shown on the room
   screen. App users only.

   Who sees what:
   - The activities (with their correct answers) live in the plan, which
     only leaders read.
   - The room — what the projector and every phone may show — is a public
     snapshot the leader's console writes: the current activity without its
     answers, the timer, and results once the settings allow them.
   - Answers are one row per student per activity, written only while that
     activity is open. The leader's console tallies them; free text waits
     for a leader before the room ever sees it.

   Everything here is pure, so the console, the room and the tests agree. */

export type LiveKind = 'trivia' | 'this' | 'cloud' | 'verse' | 'tug';

export const LIVE_TYPES: { id: LiveKind; label: string; icon: string; note: string }[] = [
  { id: 'trivia', label: 'Trivia', icon: 'ph-question', note: 'One right answer. Fast and right ranks highest.' },
  { id: 'this', label: 'This or that', icon: 'ph-arrows-left-right', note: 'Two or more sides, no right answer.' },
  { id: 'cloud', label: 'Word cloud', icon: 'ph-cloud', note: 'One word each. Waits for a leader before the room sees it.' },
  { id: 'verse', label: 'Verse fill-in', icon: 'ph-book-open-text', note: 'Put [brackets] around the words to blank out.' },
  { id: 'tug', label: 'Tug-of-war', icon: 'ph-hand-pointing', note: 'Two sides tap as fast as they can.' }
];
export const liveType = (k: LiveKind) => LIVE_TYPES.find((t) => t.id === k)!;

export interface LiveOption {
  l: string;
  correct?: boolean;
}

export interface LiveActivity {
  id: string;
  type: LiveKind;
  prompt: string;
  options?: LiveOption[];
  /** Verse fill-in: the text with [blanks]. */
  verse?: string;
  /** Seconds, or the night's default. */
  timer: number | 'night';
}

/** The nine night defaults. */
export interface LiveSettings {
  timer: number;
  /** Results on the room screen as answers arrive, or only on reveal. */
  results: 'live' | 'reveal';
  /** The join QR stays up, or only until the first activity starts. */
  qr: 'always' | 'start';
  names: 'nickname' | 'first';
  /** Trivia and verse fill-in rank the room. */
  points: 'on' | 'off';
  /** Word-cloud words wait for a leader. */
  approve: 'on' | 'off';
  /** How tug-of-war splits the room. */
  teams: 'squads' | 'grade' | 'auto';
  layout: 'rail' | 'stage';
  /** Scanning the room QR checks the student in. */
  checkin: 'on' | 'off';
}

export const LIVE_DEFAULTS: LiveSettings = { timer: 20, results: 'live', qr: 'always', names: 'nickname', points: 'on', approve: 'on', teams: 'squads', layout: 'rail', checkin: 'on' };

export const LIVE_SETTINGS: { key: keyof LiveSettings; label: string; help: string; opts: [string | number, string][] }[] = [
  { key: 'timer', label: 'Timer', help: 'Each activity can override it.', opts: [[0, 'None'], [10, '10s'], [20, '20s'], [30, '30s'], [45, '45s']] },
  { key: 'results', label: 'Results on the screen', help: 'Live builds suspense the wrong way for a quiet room.', opts: [['live', 'As they come in'], ['reveal', 'On reveal']] },
  { key: 'qr', label: 'Join code', help: 'The QR on the room screen.', opts: [['always', 'Always'], ['start', 'Until we start']] },
  { key: 'names', label: 'Names on the screen', help: 'Never a last name.', opts: [['nickname', 'Nickname'], ['first', 'First name']] },
  { key: 'points', label: 'Points', help: 'Trivia and verse rank the room tonight. They don’t post to the squad board.', opts: [['on', 'On'], ['off', 'Off']] },
  { key: 'approve', label: 'Free text', help: 'Word-cloud words wait for a leader before the room sees them.', opts: [['on', 'Leader approves'], ['off', 'Straight up']] },
  { key: 'teams', label: 'Tug-of-war sides', help: 'Who pulls with whom.', opts: [['squads', 'Squads'], ['grade', 'Grade'], ['auto', 'Split the room']] },
  { key: 'layout', label: 'Room screen', help: 'Rail keeps the join code and ranks beside the activity.', opts: [['rail', 'Rail'], ['stage', 'Stage']] },
  { key: 'checkin', label: 'Check-in', help: 'Scanning the room QR checks the student in for tonight.', opts: [['on', 'On'], ['off', 'Off']] }
];

export const LIVE_TEMPLATES: Record<LiveKind, () => Omit<LiveActivity, 'id'>> = {
  trivia: () => ({ type: 'trivia', prompt: 'Who led Israel across the Jordan?', options: [{ l: 'Moses' }, { l: 'Joshua', correct: true }, { l: 'Caleb' }, { l: 'Aaron' }], timer: 'night' }),
  this: () => ({ type: 'this', prompt: 'Which is harder to forgive?', options: [{ l: 'A friend' }, { l: 'Family' }], timer: 'night' }),
  cloud: () => ({ type: 'cloud', prompt: 'One word for how this week felt', timer: 'night' }),
  verse: () => ({ type: 'verse', prompt: 'Finish Joshua 1:9', verse: 'Be strong and [courageous]. Do not be afraid; do not be discouraged, for the LORD your God will be with you [wherever] you go.', timer: 'night' }),
  tug: () => ({ type: 'tug', prompt: 'Tug-of-war: tap as fast as you can', timer: 30 })
};

export const timerOf = (a: LiveActivity, s: LiveSettings) => (a.timer === 'night' ? s.timer : a.timer);

export function verseParts(text: string | undefined): { t: string; blank: boolean }[] {
  return String(text ?? '')
    .split(/\[([^\]]*)\]/)
    .map((t, i) => ({ t, blank: i % 2 === 1 }))
    .filter((p) => p.t || p.blank);
}

export const normWord = (w: string) =>
  w
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 24);

/* ── answers ─────────────────────────────────────────────────────────── */
export type LiveValue = { choice: number } | { word: string } | { blanks: string[] } | { taps: number };

export interface LiveAnswer {
  act: string;
  /** Membership id: one answer per person per activity. */
  member: string;
  /** First name, from the roster. */
  name: string;
  /** What they asked to be called tonight. */
  nick: string;
  /** Tug-of-war side, worked out on their phone from the night's setting. */
  side?: 0 | 1;
  at: number;
  value: LiveValue;
}

/* ── the room ────────────────────────────────────────────────────────── */
export type LiveResults =
  | { kind: 'choice'; counts: number[]; correct: number | null }
  | { kind: 'cloud'; words: [string, number][] }
  | { kind: 'verse'; blanks: { answer: string; right: number }[]; total: number }
  | { kind: 'tug'; sides: [string, string]; taps: [number, number] };

/** An activity as the room may see it: no correct answers, blanks masked. */
export interface RoomActivity {
  id: string;
  type: LiveKind;
  prompt: string;
  options?: string[];
  /** Verse with each blank's length only, until reveal fills them in. */
  verse?: { t: string; blank: boolean }[];
  sides?: [string, string];
  timer: number;
}

export type RoomView = 'activity' | 'board' | 'join' | 'blank';

export interface LiveRoom {
  night: string;
  /** Which of the night's activities, and how many there are. */
  idx: number;
  total: number;
  act: RoomActivity | null;
  /** The activity accepting answers right now. */
  open: string | null;
  openedAt: number | null;
  endsAt: number | null;
  revealed: boolean;
  view: RoomView;
  /** Shown only as the settings allow. */
  results: LiveResults | null;
  answered: number;
  board: { name: string; pts: number }[];
  /** When each activity opened, for scoring by speed, and when it closed. */
  opened: Record<string, number>;
  closed: Record<string, number>;
  settings: Pick<LiveSettings, 'layout' | 'qr' | 'names' | 'points' | 'checkin' | 'teams'>;
  started: boolean;
  ended: boolean;
  at: number;
}

export function roomActivity(a: LiveActivity, s: LiveSettings, sides: [string, string], revealed: boolean): RoomActivity {
  return {
    id: a.id,
    type: a.type,
    prompt: a.prompt,
    options: a.options?.map((o, i) => o.l || 'Answer ' + (i + 1)),
    verse: a.type === 'verse' ? verseParts(a.verse).map((p) => (p.blank && !revealed ? { t: '_'.repeat(Math.max(4, p.t.length)), blank: true } : p)) : undefined,
    sides: a.type === 'tug' ? sides : undefined,
    timer: timerOf(a, s)
  };
}

export const latest = (answers: LiveAnswer[], act: string) => {
  const by = new Map<string, LiveAnswer>();
  for (const a of answers) if (a.act === act && (!by.has(a.member) || by.get(a.member)!.at <= a.at)) by.set(a.member, a);
  return [...by.values()];
};

/** Free text that hasn't been decided yet, most-sent first. */
export function pendingWords(answers: LiveAnswer[], act: string, decided: Record<string, boolean>) {
  const n = new Map<string, number>();
  for (const a of latest(answers, act)) {
    if (!('word' in a.value)) continue;
    const w = normWord(a.value.word);
    if (w && decided[w] === undefined) n.set(w, (n.get(w) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1]);
}

export function emptyRoom(night: string, total: number, s: LiveSettings, now: number): LiveRoom {
  return { night, idx: 0, total, act: null, open: null, openedAt: null, endsAt: null, revealed: false, view: 'join', results: null, answered: 0, board: [], opened: {}, closed: {}, settings: pickRoom(s), started: false, ended: false, at: now };
}
export const pickRoom = (s: LiveSettings): LiveRoom['settings'] => ({ layout: s.layout, qr: s.qr, names: s.names, points: s.points, checkin: s.checkin, teams: s.teams });

/** One activity's results from its answers. Words show only once approved
 *  (or straight up when approval is off). */
export function tally(a: LiveActivity, answers: LiveAnswer[], s: LiveSettings, sides: [string, string], decided: Record<string, boolean>): LiveResults {
  const rows = latest(answers, a.id);
  if (a.type === 'trivia' || a.type === 'this') {
    const counts = (a.options ?? []).map(() => 0);
    for (const r of rows) if ('choice' in r.value && r.value.choice >= 0 && r.value.choice < counts.length) counts[r.value.choice]++;
    const ci = a.type === 'trivia' ? (a.options ?? []).findIndex((o) => o.correct) : -1;
    return { kind: 'choice', counts, correct: ci >= 0 ? ci : null };
  }
  if (a.type === 'cloud') {
    const n = new Map<string, number>();
    for (const r of rows) {
      if (!('word' in r.value)) continue;
      const w = normWord(r.value.word);
      if (!w) continue;
      if (s.approve === 'on' ? decided[w] !== true : decided[w] === false) continue;
      n.set(w, (n.get(w) ?? 0) + 1);
    }
    return { kind: 'cloud', words: [...n.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 40) };
  }
  if (a.type === 'verse') {
    const blanks = verseParts(a.verse)
      .filter((p) => p.blank)
      .map((p, i) => ({ answer: p.t, right: rows.filter((r) => 'blanks' in r.value && normWord(r.value.blanks[i] ?? '') === normWord(p.t)).length }));
    return { kind: 'verse', blanks, total: rows.length };
  }
  const taps: [number, number] = [0, 0];
  for (const r of rows) if ('taps' in r.value) taps[r.side ?? 0] += r.value.taps;
  return { kind: 'tug', sides, taps };
}

/** What the room may see of an activity's results right now: nothing until
 *  the settings allow it, and never which answer is right before the reveal. */
export function publicResults(r: LiveResults | null, revealed: boolean, s: Pick<LiveSettings, 'results'>, view: RoomView): LiveResults | null {
  if (!r || !(revealed || (s.results === 'live' && view === 'activity'))) return null;
  return r.kind === 'choice' && !revealed ? { ...r, correct: null } : r;
}

/** Points for one answer: right answers score, faster scores more. */
export function pointsFor(a: LiveActivity, r: LiveAnswer, openedAt: number, s: LiveSettings): number {
  const secs = timerOf(a, s) || 30;
  const speed = Math.max(0, Math.min(1, 1 - (r.at - openedAt) / (secs * 1000)));
  if (a.type === 'trivia' && 'choice' in r.value) return a.options?.[r.value.choice]?.correct ? 500 + Math.round(500 * speed) : 0;
  if (a.type === 'verse' && 'blanks' in r.value) {
    const blanks = verseParts(a.verse).filter((p) => p.blank);
    if (!blanks.length) return 0;
    const v = r.value;
    const right = blanks.filter((p, i) => normWord(v.blanks[i] ?? '') === normWord(p.t)).length;
    return right ? Math.round(((500 + 500 * speed) * right) / blanks.length) : 0;
  }
  return 0;
}

/** The night's ranked list: every scored activity that has opened. Ties
 *  share the order they reached it in. */
export function leaderboard(acts: LiveActivity[], answers: LiveAnswer[], opened: Record<string, number>, s: LiveSettings) {
  if (s.points === 'off') return [];
  const pts = new Map<string, { name: string; pts: number; first: number }>();
  for (const a of acts) {
    if (opened[a.id] === undefined || (a.type !== 'trivia' && a.type !== 'verse')) continue;
    for (const r of latest(answers, a.id)) {
      const name = s.names === 'first' ? r.name : r.nick || r.name;
      const cur = pts.get(r.member) ?? { name, pts: 0, first: r.at };
      cur.pts += pointsFor(a, r, opened[a.id], s);
      cur.first = Math.min(cur.first, r.at);
      pts.set(r.member, cur);
    }
  }
  return [...pts.values()].sort((a, b) => b.pts - a.pts || a.first - b.first).map(({ name, pts }) => ({ name, pts }));
}

/** Which side of a tug-of-war a student pulls for. Squads and grades split
 *  by their order; anything else is a stable coin flip on their id. */
export function sideFor(how: LiveSettings['teams'], me: { member: string; team: string | null; grade: string }, squads: string[], grades: string[]): 0 | 1 {
  if (how === 'squads' && me.team && squads.includes(me.team)) return (squads.indexOf(me.team) % 2) as 0 | 1;
  if (how === 'grade' && grades.includes(me.grade)) return (grades.indexOf(me.grade) < Math.ceil(grades.length / 2) ? 0 : 1) as 0 | 1;
  let h = 0;
  for (const c of me.member) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 2) as 0 | 1;
}

export function sidesFor(how: LiveSettings['teams'], squads: { id: string; name: string }[], grades: string[]): [string, string] {
  if (how === 'squads' && squads.length >= 2) {
    const even = squads.filter((_, i) => i % 2 === 0).map((t) => t.name);
    const odd = squads.filter((_, i) => i % 2 === 1).map((t) => t.name);
    return [even.join(' & '), odd.join(' & ')];
  }
  if (how === 'grade' && grades.length >= 2) {
    const half = Math.ceil(grades.length / 2);
    const label = (g: string[]) => (g.length === 1 ? g[0] + ' grade' : g[0] + '–' + g[g.length - 1] + ' grade');
    return [label(grades.slice(0, half)), label(grades.slice(half))];
  }
  return ['Left side', 'Right side'];
}

/** One line per activity for the night's debrief. */
export function summaryLine(a: LiveActivity, r: LiveResults): string {
  if (r.kind === 'choice') {
    const total = r.counts.reduce((x, y) => x + y, 0);
    if (!total) return 'No answers';
    if (a.type === 'trivia') return r.correct === null ? total + ' answered · no correct answer marked' : Math.round((r.counts[r.correct] / total) * 100) + '% chose ' + (a.options?.[r.correct]?.l ?? '') + ' · ' + total + ' answered';
    const top = r.counts.indexOf(Math.max(...r.counts));
    return (a.options?.[top]?.l ?? '') + ' ' + Math.round((r.counts[top] / total) * 100) + '% · ' + total + ' answered';
  }
  if (r.kind === 'cloud') return r.words.length ? 'Top words: ' + r.words.slice(0, 3).map((w) => w[0]).join(', ') + ' · ' + r.words.length + ' approved' : 'No words shown';
  if (r.kind === 'verse') return r.total ? r.blanks.map((b) => '“' + b.answer + '” ' + Math.round((b.right / r.total) * 100) + '%').join(' · ') + ' right · ' + r.total + ' answered' : 'No answers';
  const t = r.taps[0] + r.taps[1];
  if (!t) return 'No taps';
  const w = r.taps[0] >= r.taps[1] ? 0 : 1;
  return r.sides[w] + ' won, ' + Math.round((r.taps[w] / t) * 100) + '% to ' + Math.round((r.taps[1 - w] / t) * 100) + '%';
}

/* ── the demo room ───────────────────────────────────────────────────── */
/** Demo only: the room answering. Each simulated student answers once,
 *  staggered across the timer; only what has "arrived" by `now` counts. */
export function simulatedAnswers(a: LiveActivity, openedAt: number, closedAt: number | null, now: number, names: string[], s: LiveSettings): LiveAnswer[] {
  let seed = 0;
  for (const c of a.id) seed = (seed * 33 + c.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const secs = Math.max(6, Math.min(timerOf(a, s) || 15, 20));
  const out: LiveAnswer[] = [];
  const crowd = names.slice(0, 24);
  const WORDS = ['tired', 'busy', 'stressed', 'hopeful', 'fun', 'loud', 'long', 'peaceful', 'grateful', 'tired', 'busy', 'okay'];
  const blanks = verseParts(a.verse).filter((p) => p.blank);
  crowd.forEach((name, i) => {
    const at = openedAt + 1200 + rnd() * secs * 1000;
    const roll = rnd();
    let value: LiveValue;
    if (a.type === 'trivia' || a.type === 'this') {
      const n = a.options?.length ?? 2;
      const ci = a.options?.findIndex((o) => o.correct) ?? -1;
      value = { choice: ci >= 0 && roll < 0.65 ? ci : Math.floor(rnd() * n) };
    } else if (a.type === 'cloud') value = { word: WORDS[Math.floor(roll * WORDS.length)] };
    else if (a.type === 'verse') value = { blanks: blanks.map((b) => (rnd() < 0.7 ? b.t : 'faithful')) };
    else value = { taps: Math.round(8 + roll * 30 * Math.min(1, (now - openedAt) / (secs * 1000))) };
    if (at > now || (closedAt !== null && at > closedAt)) return;
    const first = name.split(' ')[0];
    out.push({ act: a.id, member: 'sim-' + i, name: first, nick: first, side: (i % 2) as 0 | 1, at, value });
  });
  return out;
}
