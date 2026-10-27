/* The report builder — "any report he wants, even for things we haven't
   thought of". A report is five decisions: what it reads, which columns,
   what to leave out, how to group, how to order.

   `sourceRows()` is the only place a query goes. Filtering, grouping,
   sorting, the preview, CSV and the delivery schedule are generic and driven
   by the field list — and that list is also the allow-list: a column id that
   isn't declared here can't be reported, whatever a saved report says.

   Deliveries: a report, an audience, a cadence and a time. Recipients are
   worked out when it goes out, from who coaches and captains each squad that
   day — never stored on the delivery, so a trade can't leave a stale list. */
import { history } from '@/lib/cycle';
import { isoDay, parseLocalISO, weekOf } from '@/lib/dates';
import { playerStats } from '@/lib/goals';
import { categoryTotals, standings, studentRanks } from '@/lib/scoring';
import type { CustomReport, Delivery, DeliveryAudience, MinistryData, ReportFieldKind, ReportFilter } from '@/lib/types/model';

export interface ReportField {
  id: string;
  label: string;
  kind: ReportFieldKind;
}

type Row = Record<string, string | number>;

export interface ReportSource {
  id: string;
  label: string;
  hint: string;
  fields: ReportField[];
}

const f = (id: string, label: string, kind: ReportFieldKind = 'text'): ReportField => ({ id, label, kind });

export const REPORT_SOURCES: ReportSource[] = [
  { id: 'students', label: 'Students', hint: 'One row per student on a roster', fields: [f('name', 'Name'), f('squad', 'Squad', 'enum'), f('grade', 'Grade', 'enum'), f('points', 'Points', 'num'), f('lastSix', 'Nights of the last six', 'num'), f('tonight', 'Here tonight', 'enum'), f('captain', 'Captain', 'enum'), f('guest', 'Guest', 'enum'), f('guardian', 'Guardian')] },
  { id: 'ledger', label: 'Points ledger', hint: 'Every entry, approved or not', fields: [f('date', 'Date'), f('week', 'Week', 'num'), f('squad', 'Squad', 'enum'), f('category', 'Category', 'enum'), f('amount', 'Points', 'num'), f('status', 'Status', 'enum'), f('student', 'Student'), f('reason', 'Reason'), f('by', 'Entered by', 'enum'), f('decidedBy', 'Decided by', 'enum')] },
  { id: 'attendance', label: 'Attendance by week', hint: 'Each squad, each meeting night', fields: [f('week', 'Week', 'num'), f('date', 'Date'), f('squad', 'Squad', 'enum'), f('roster', 'Roster', 'num'), f('present', 'Present', 'num'), f('percent', 'Percent', 'num')] },
  { id: 'visitors', label: 'New friends', hint: 'Every friend brought, by name', fields: [f('week', 'Week', 'num'), f('friend', 'Friend'), f('broughtBy', 'Brought by'), f('squad', 'Squad', 'enum'), f('kind', 'New or known', 'enum'), f('count', 'Friends', 'num')] },
  { id: 'verses', label: 'Verse board', hint: 'Verses recited, per student', fields: [f('student', 'Student'), f('squad', 'Squad', 'enum'), f('verses', 'Verses', 'num'), f('points', 'Points', 'num'), f('nights', 'Nights', 'num')] },
  { id: 'volunteers', label: 'Volunteers', hint: 'The crew and the bench', fields: [f('name', 'Name'), f('job', 'Job', 'enum'), f('post', 'Post'), f('squad', 'Squad', 'enum'), f('tonight', 'Tonight', 'enum'), f('list', 'Crew or bench', 'enum'), f('check', 'Background check', 'enum')] },
  { id: 'care', label: 'Care follow-ups', hint: 'Open care reminders', fields: [f('name', 'Name'), f('note', 'Note'), f('flaggedBy', 'Flagged by', 'enum'), f('done', 'Done', 'enum')] },
  { id: 'players', label: 'Player stats', hint: 'Goals, assists and MVPs, per student', fields: [f('name', 'Name'), f('squad', 'Squad', 'enum'), f('goals', 'Goals', 'num'), f('assists', 'Assists', 'num'), f('mvp', 'MVPs', 'num')] },
  { id: 'games', label: 'Game stats', hint: 'Game points by squad and week', fields: [f('week', 'Week', 'num'), f('squad', 'Squad', 'enum'), f('points', 'Points', 'num'), f('entries', 'Entries', 'num')] },
  { id: 'awards', label: 'Awards', hint: 'Each award and how it is decided', fields: [f('award', 'Award'), f('decidedBy', 'Decided by', 'enum'), f('recipient', 'Goes to', 'enum'), f('votingOpen', 'Voting open', 'enum'), f('nominees', 'Nominees', 'num')] },
  { id: 'squads', label: 'Squad totals', hint: 'The board, as a table', fields: [f('rank', 'Rank', 'num'), f('squad', 'Squad'), f('total', 'Total', 'num'), f('roster', 'Roster', 'num'), f('visitors', 'Visitor points', 'num'), f('games', 'Game points', 'num')] }
];

export const REPORT_OPS: Record<ReportFieldKind, { id: string; label: string; none?: boolean }[]> = {
  text: [
    { id: 'contains', label: 'contains' },
    { id: 'is', label: 'is' },
    { id: 'isnot', label: 'is not' },
    { id: 'empty', label: 'is empty', none: true },
    { id: 'notempty', label: 'is not empty', none: true }
  ],
  num: [
    { id: 'eq', label: '=' },
    { id: 'ne', label: '≠' },
    { id: 'gt', label: '>' },
    { id: 'ge', label: '≥' },
    { id: 'lt', label: '<' },
    { id: 'le', label: '≤' }
  ],
  enum: [
    { id: 'is', label: 'is' },
    { id: 'isnot', label: 'is not' }
  ]
};

export const REPORT_PRESETS: Omit<CustomReport, 'id' | 'at'>[] = [
  { name: 'Who is slipping away', source: 'students', columns: ['name', 'squad', 'grade', 'lastSix', 'guardian'], filters: [{ field: 'lastSix', op: 'le', value: '2' }, { field: 'guest', op: 'is', value: 'no' }], groupBy: null, sort: { field: 'lastSix', dir: 'asc' } },
  { name: 'Who is inviting friends', source: 'visitors', columns: ['broughtBy', 'squad', 'count'], filters: [], groupBy: 'broughtBy', sort: { field: 'count', dir: 'desc' } },
  { name: 'Background checks to chase', source: 'volunteers', columns: ['name', 'job', 'list', 'check'], filters: [{ field: 'check', op: 'isnot', value: 'current' }], groupBy: null, sort: { field: 'name', dir: 'asc' } },
  { name: 'What a coach put on the board', source: 'ledger', columns: ['date', 'squad', 'category', 'amount', 'student', 'reason', 'by'], filters: [{ field: 'by', op: 'contains', value: 'Coach' }], groupBy: null, sort: { field: 'date', dir: 'desc' } }
];

export const sourceOf = (id: string) => REPORT_SOURCES.find((s) => s.id === id) ?? REPORT_SOURCES[0];

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

/** The only place a report reads data. */
export function sourceRows(d: MinistryData, source: string): Row[] {
  const team = (id: string | null | undefined) => d.teams.find((t) => t.id === id)?.name ?? '';
  const cat = (id: string) => d.cats.find((c) => c.id === id)?.label ?? id;
  const weekOfAt = (at: number) => weekOf(d.config.meetingDates, isoDay(new Date(at)));
  switch (source) {
    case 'students': {
      const pts = new Map(studentRanks(d.roster, d.ledger, d.studentSeedPoints).map((r) => [r.name, r.total]));
      return d.roster.map((s) => ({
        name: s.name,
        squad: team(s.team),
        grade: s.grade,
        points: pts.get(s.name) ?? 0,
        lastSix: history(d, s.name, d.tonight.date || isoDay(new Date())).filter(Boolean).length,
        tonight: yesNo(!!d.tonight.presence[s.name]),
        captain: yesNo(!!s.captain),
        guest: yesNo(!!s.guest),
        guardian: d.families[s.name]?.guardian ?? ''
      }));
    }
    case 'ledger':
      return d.ledger.map((e) => ({
        date: isoDay(new Date(e.at)),
        week: weekOfAt(e.at),
        squad: team(e.team),
        category: cat(e.cat),
        amount: e.amount,
        status: e.status,
        student: e.student ?? '',
        reason: e.why,
        by: e.by,
        decidedBy: e.decidedBy ?? ''
      }));
    case 'attendance':
      return d.teams.flatMap((t) => {
        const roster = d.roster.filter((r) => r.team === t.id && !r.guest).length;
        return d.config.meetingDates
          .slice()
          .sort()
          .map((iso, i) => {
            const pct = d.attendanceHistory[t.id]?.[i] ?? 0;
            return { week: i + 1, date: iso, squad: t.name, roster, present: Math.round((pct / 100) * roster), percent: pct };
          })
          .filter((r) => r.date <= (d.tonight.date || r.date));
      });
    case 'visitors':
      return d.visitorLog.flatMap((v) => (v.names.length ? v.names : ['']).map((n) => ({ week: v.week, friend: n, broughtBy: v.student, squad: team(v.team), kind: v.kind, count: 1 })));
    case 'verses': {
      const by = new Map<string, Row>();
      for (const v of d.verseLog) {
        const r = by.get(v.student) ?? { student: v.student, squad: team(v.team), verses: 0, points: 0, nights: 0 };
        r.verses = Number(r.verses) + v.count;
        r.points = Number(r.points) + v.pts;
        r.nights = Number(r.nights) + 1;
        by.set(v.student, r);
      }
      return [...by.values()];
    }
    case 'volunteers': {
      const check = (meta: string) => (/expire/i.test(meta) ? 'expiring' : /check current|current/i.test(meta) ? 'current' : 'not on file');
      return [
        ...d.huddle.crew.map((c) => ({ name: c.name, job: c.job, post: c.post, squad: team(c.team), tonight: d.huddle.crewState[c.id] ?? '—', list: 'crew', check: 'not on file' })),
        ...d.huddle.bench.map((b) => ({ name: b.name, job: 'Bench', post: '', squad: '', tonight: '—', list: 'bench', check: check(b.meta) }))
      ];
    }
    case 'care':
      return d.careReminders.filter((c) => c.kind !== 'note').map((c) => ({ name: c.name, note: c.meta, flaggedBy: c.flaggedBy ?? '', done: yesNo(!!c.done) }));
    case 'games': {
      const by = new Map<string, Row>();
      for (const e of d.ledger) {
        if (e.cat !== 'games' || e.status !== 'approved') continue;
        const k = weekOfAt(e.at) + '|' + e.team;
        const r = by.get(k) ?? { week: weekOfAt(e.at), squad: team(e.team), points: 0, entries: 0 };
        r.points = Number(r.points) + e.amount;
        r.entries = Number(r.entries) + 1;
        by.set(k, r);
      }
      return [...by.values()];
    }
    case 'players':
      return playerStats(d.ledger, (n) => d.roster.find((r) => r.name === n)?.team ?? '').map((p) => ({ name: p.name, squad: team(p.team), goals: p.goals, assists: p.assists, mvp: p.mvp }));
    case 'awards':
      return d.awards.map((a) => ({ award: a.name, decidedBy: a.decidedBy, recipient: a.recipientType ?? 'team', votingOpen: yesNo(!!a.votingOpen), nominees: a.nominees?.length ?? 0 }));
    case 'squads':
      return standings(d.teams, d.cats, d.ledger).map((t, i) => {
        const c = categoryTotals(d.ledger, t.id);
        return { rank: i + 1, squad: t.name, total: t.total, roster: d.roster.filter((r) => r.team === t.id).length, visitors: c.visitors ?? 0, games: c.games ?? 0 };
      });
  }
  return [];
}

function passes(row: Row, flt: ReportFilter, kind: ReportFieldKind): boolean {
  const v = row[flt.field];
  if (kind === 'num') {
    const a = Number(v);
    const b = Number(flt.value);
    if (flt.value === '' || isNaN(b)) return true;
    return flt.op === 'eq' ? a === b : flt.op === 'ne' ? a !== b : flt.op === 'gt' ? a > b : flt.op === 'ge' ? a >= b : flt.op === 'lt' ? a < b : flt.op === 'le' ? a <= b : true;
  }
  const s = String(v ?? '').toLowerCase();
  const want = flt.value.trim().toLowerCase();
  if (flt.op === 'empty') return !s;
  if (flt.op === 'notempty') return !!s;
  if (!want) return true;
  return flt.op === 'contains' ? s.includes(want) : flt.op === 'is' ? s === want : flt.op === 'isnot' ? s !== want : true;
}

export interface ReportResult {
  columns: ReportField[];
  rows: Row[];
  /** Rows before grouping, after filtering. */
  matched: number;
}

/** Filter, group (numbers sum, a count column appears), sort. Columns that
 *  aren't declared on the source are dropped: the field list is the allow-list. */
export function runReport(d: MinistryData, spec: Pick<CustomReport, 'source' | 'columns' | 'filters' | 'groupBy' | 'sort'>): ReportResult {
  const src = sourceOf(spec.source);
  const kindOf = (id: string) => src.fields.find((x) => x.id === id)?.kind ?? 'text';
  const allowed = (id: string) => src.fields.some((x) => x.id === id);
  let rows = sourceRows(d, src.id).filter((r) => spec.filters.filter((x) => allowed(x.field)).every((x) => passes(r, x, kindOf(x.field))));
  const matched = rows.length;
  let columns = spec.columns.filter(allowed).map((id) => src.fields.find((x) => x.id === id)!);
  if (!columns.length) columns = src.fields.slice(0, 4);
  if (spec.groupBy && allowed(spec.groupBy)) {
    const g = spec.groupBy;
    const by = new Map<string, Row>();
    for (const r of rows) {
      const k = String(r[g] ?? '');
      const acc = by.get(k) ?? { [g]: k, rows: 0 };
      acc.rows = Number(acc.rows) + 1;
      for (const c of columns) if (c.id !== g && c.kind === 'num') acc[c.id] = Number(acc[c.id] ?? 0) + Number(r[c.id] ?? 0);
      by.set(k, acc);
    }
    rows = [...by.values()];
    const groupField = src.fields.find((x) => x.id === g)!;
    columns = [groupField, ...columns.filter((c) => c.id !== g && c.kind === 'num'), { id: 'rows', label: 'Rows', kind: 'num' }];
  }
  if (spec.sort && (columns.some((c) => c.id === spec.sort!.field) || allowed(spec.sort.field))) {
    const { field, dir } = spec.sort;
    const num = kindOf(field) === 'num' || field === 'rows';
    rows = [...rows].sort((a, b) => {
      const x = num ? Number(a[field] ?? 0) - Number(b[field] ?? 0) : String(a[field] ?? '').localeCompare(String(b[field] ?? ''));
      return dir === 'asc' ? x : -x;
    });
  }
  return { columns, rows, matched };
}

/* ── built-in reports and deliveries ─────────────────────────────────── */
export const REPORT_KINDS = [
  { id: 'roster', label: 'Squad roster', spec: { source: 'students', columns: ['name', 'grade', 'captain', 'lastSix', 'guardian'], filters: [], groupBy: null, sort: { field: 'name', dir: 'asc' as const } } },
  { id: 'standings', label: 'Standings', spec: { source: 'squads', columns: ['rank', 'squad', 'total', 'roster'], filters: [], groupBy: null, sort: { field: 'rank', dir: 'asc' as const } } },
  { id: 'visitors', label: 'Visitor follow-up', spec: { source: 'visitors', columns: ['week', 'friend', 'broughtBy', 'squad', 'kind'], filters: [], groupBy: null, sort: { field: 'week', dir: 'desc' as const } } },
  { id: 'attendance', label: 'Attendance by week', spec: { source: 'attendance', columns: ['week', 'date', 'squad', 'present', 'percent'], filters: [], groupBy: null, sort: { field: 'week', dir: 'desc' as const } } },
  { id: 'verses', label: 'Verse board', spec: { source: 'verses', columns: ['student', 'squad', 'verses', 'points'], filters: [], groupBy: null, sort: { field: 'verses', dir: 'desc' as const } } }
];

/** A built-in report or one the pastor saved. */
export function reportSpec(d: MinistryData, id: string): { label: string; spec: Pick<CustomReport, 'source' | 'columns' | 'filters' | 'groupBy' | 'sort'> } | null {
  const k = REPORT_KINDS.find((x) => x.id === id);
  if (k) return { label: k.label, spec: k.spec };
  const c = d.customReports.find((x) => x.id === id);
  return c ? { label: c.name, spec: c } : null;
}

/** A delivery's copy for one squad: the same report, narrowed to it. */
export function scopedSpec(spec: Pick<CustomReport, 'source' | 'columns' | 'filters' | 'groupBy' | 'sort'>, squadName: string | null) {
  if (!squadName || !sourceOf(spec.source).fields.some((x) => x.id === 'squad')) return spec;
  return { ...spec, filters: [...spec.filters, { field: 'squad', op: 'is', value: squadName }] };
}

export const AUDIENCES: { id: DeliveryAudience; label: string }[] = [
  { id: 'squadLeads', label: 'Coaches and captains' },
  { id: 'coaches', label: 'Coaches' },
  { id: 'captains', label: 'Captains' },
  { id: 'leaders', label: 'Youth pastor and admins' },
  { id: 'staff', label: 'Everyone on staff' }
];

export const CADENCES = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'nightAfter', label: 'The day after each night' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'close', label: 'When the night closes' }
] as const;

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface RecipientGroup {
  /** The squad this copy is for, or null for the whole ministry. */
  team: string | null;
  label: string;
  names: string[];
}

/** Who gets a delivery, worked out now — from the crew, the roster's
 *  captains and the people with leader roles. */
export function deliveryRecipientGroups(d: MinistryData, dl: Delivery): RecipientGroup[] {
  const coaches = (team: string | null) => d.huddle.crew.filter((c) => c.team && (!team || c.team === team) && /coach|small group/i.test(c.job)).map((c) => c.name);
  const captains = (team: string | null) => d.roster.filter((r) => r.captain && (!team || r.team === team)).map((r) => r.name + ' (captain)');
  const leaders = [
    ...d.huddle.crew.filter((c) => !c.team && /pastor|admin|director/i.test(c.job)).map((c) => c.name),
    ...(d.people ?? []).filter((p) => p.role === 'leader' || p.role === 'owner').map((p) => p.name)
  ];
  const staff = [...new Set([...d.huddle.crew.map((c) => c.name), ...leaders])];
  const who = (team: string | null): string[] => {
    switch (dl.audience) {
      case 'coaches':
        return coaches(team);
      case 'captains':
        return captains(team);
      case 'squadLeads':
        return [...coaches(team), ...captains(team)];
      case 'leaders':
        return [...new Set(leaders)];
      case 'staff':
        return staff;
    }
  };
  const perSquad = dl.scope === 'own' && (dl.audience === 'coaches' || dl.audience === 'captains' || dl.audience === 'squadLeads');
  if (!perSquad) return [{ team: null, label: 'Whole ministry', names: who(null) }];
  return d.teams.map((t) => ({ team: t.id, label: t.name, names: who(t.id) }));
}

/** When a delivery goes out in the period containing `now`, and that
 *  period's key — (delivery, period) is the idempotency key, so a retry can
 *  never send twice. Null when nothing is due in this period. */
export function deliveryDue(d: MinistryData, dl: Delivery, now: number): { at: number; period: string } | null {
  /* Leader reports go out the moment the night is closed at the debrief —
     once per night, whoever closes it and however many times. */
  if (dl.cadence === 'close') {
    const h = d.huddle;
    if (!h?.nightClosed || !h.closedAt) return null;
    return { at: h.closedAt, period: 'c:' + (d.tonight?.date || isoDay(new Date(h.closedAt))) };
  }
  const today = new Date(now);
  const [h, m] = dl.time.split(':').map((x) => Number(x) || 0);
  if (dl.cadence === 'weekly') {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() - dl.day + 7) % 7), h, m).getTime();
    return { at, period: 'w:' + isoDay(new Date(at)) };
  }
  if (dl.cadence === 'monthly') {
    const at = new Date(today.getFullYear(), today.getMonth(), Math.min(28, Math.max(1, dl.day)), h, m).getTime();
    return { at, period: 'm:' + isoDay(new Date(at)).slice(0, 7) };
  }
  const nights = d.config.meetingDates.filter((x) => x < isoDay(today)).sort();
  const last = nights[nights.length - 1];
  if (!last) return null;
  const base = parseLocalISO(last)!;
  const at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, h, m).getTime();
  return { at, period: 'n:' + last };
}

/** Has this delivery gone out for its current period (by its time passing,
 *  or by hand)? */
export function deliverySent(d: MinistryData, dl: Delivery, now: number): boolean {
  const due = deliveryDue(d, dl, now);
  if (!due || !dl.on) return false;
  return now >= due.at || d.reportSendLog.some((x) => x.delivery === dl.id && x.period === due.period);
}

/** Deliveries going out later today — the notification that makes the
 *  schedule visible rather than silent. */
export function deliveriesDueToday(d: MinistryData, now: number): Delivery[] {
  const today = isoDay(new Date(now));
  return d.deliveries.filter((dl) => {
    /* A night-close report has no clock time to announce: it goes at the debrief. */
    if (!dl.on || dl.cadence === 'close') return false;
    const due = deliveryDue(d, dl, now);
    return !!due && isoDay(new Date(due.at)) === today && now < due.at;
  });
}

export function deliverySentence(d: MinistryData, dl: Delivery): string {
  const rep = reportSpec(d, dl.report)?.label ?? 'A report';
  const aud = AUDIENCES.find((a) => a.id === dl.audience)?.label.toLowerCase() ?? '';
  const who = rep + ' to ' + aud + (dl.scope === 'own' ? ', each their own squad,' : '');
  if (dl.cadence === 'close') return who + ' as soon as the night closes';
  const when = dl.cadence === 'weekly' ? 'every ' + DAYS[dl.day] : dl.cadence === 'monthly' ? 'on day ' + dl.day + ' of each month' : 'the day after each night';
  return who + ' ' + when + ' at ' + clock12(dl.time);
}

export const clock12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((x) => Number(x) || 0);
  return ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' pm' : ' am');
};
