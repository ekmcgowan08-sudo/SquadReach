/* What the plan says about itself — all derived when it's read, never
   stored. Coverage: what each graduating class will have received, by
   category, from the tags on the teaching it actually sits under. Checks:
   plain-words warnings about the plan. Suggestions: drafts offered from the
   plan's own gaps, never acted on without a leader. Publish: exactly what
   the app would start or stop showing.

   Three statuses only — healthy, attention needed, gap — each with its
   reason. No composite score, ever: these guide pastoral judgment. */
import { holyDaysBetween } from '@/lib/liturgical';
import { MONTHS_FROM_AUG, nightsOf, teachingOf, yearLabel, type Plan, type PlanItem } from '@/lib/plan';

export type Health = 'healthy' | 'attention' | 'gap';

/* ── coverage ────────────────────────────────────────────────────────── */
export const COVERAGE_GROUPS = [
  { id: 'core', name: 'Core truths', note: 'Repeated every year', target: 5, hue: 292 },
  { id: 'literacy', name: 'Biblical literacy', note: 'Systematic exposure across the whole Bible', target: 3, hue: 208 },
  { id: 'practice', name: 'Practices', note: 'Habits a graduate can keep on their own', target: 4, hue: 168 },
  { id: 'topic', name: 'Topical', note: 'Age, culture and current need', target: 3, hue: 42 }
] as const;

export const COVERAGE_CATS: { id: string; name: string; group: (typeof COVERAGE_GROUPS)[number]['id'] }[] = [
  { id: 'god', name: 'Who God is', group: 'core' },
  { id: 'jesus', name: 'Jesus and the cross', group: 'core' },
  { id: 'spirit', name: 'The Holy Spirit', group: 'core' },
  { id: 'scripture', name: 'Scripture', group: 'core' },
  { id: 'church', name: 'The church', group: 'core' },
  { id: 'grace', name: 'Salvation and grace', group: 'core' },
  { id: 'torah', name: 'Torah', group: 'literacy' },
  { id: 'gospels', name: 'Gospels', group: 'literacy' },
  { id: 'acts', name: 'Acts and the early church', group: 'literacy' },
  { id: 'psalms', name: 'Psalms and wisdom', group: 'literacy' },
  { id: 'prophets', name: 'Prophets', group: 'literacy' },
  { id: 'paul', name: 'Paul’s letters', group: 'literacy' },
  { id: 'revelation', name: 'Revelation', group: 'literacy' },
  { id: 'prayer', name: 'Prayer', group: 'practice' },
  { id: 'bible', name: 'Reading the Bible', group: 'practice' },
  { id: 'service', name: 'Service and generosity', group: 'practice' },
  { id: 'witness', name: 'Sharing faith', group: 'practice' },
  { id: 'identity', name: 'Identity and worth', group: 'topic' },
  { id: 'friendship', name: 'Friendship and conflict', group: 'topic' },
  { id: 'sexuality', name: 'Sexuality and dating', group: 'topic' },
  { id: 'anxiety', name: 'Anxiety and mental health', group: 'topic' },
  { id: 'money', name: 'Money and work', group: 'topic' },
  { id: 'family', name: 'Family', group: 'topic' }
];

const listOf = (a: string[]) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

/** Graduating classes worth showing: those with at least four of their
 *  years inside the plan. */
export function cohorts(p: Plan): number[] {
  const span = 13 - p.settings.entryGrade;
  const s = p.settings.startYear;
  const out: number[] = [];
  for (let c = s + 4; c <= s + 6 + span - 3; c++) out.push(c);
  return out.slice(0, 7);
}

/** A class of C is in its exit year (12th) in ministry year C-1 (by its
 *  starting August), and in its entry grade (13 - entry) years earlier. */
export function cohortYears(p: Plan, c: number) {
  const out: { grade: number; year: number; inPlan: boolean }[] = [];
  for (let g = p.settings.entryGrade; g <= 12; g++) {
    const y = c - 1 - (12 - g);
    const idx = y - p.settings.startYear;
    out.push({ grade: g, year: y, inPlan: idx >= 0 && idx <= 6 });
  }
  return out;
}

export interface CoverageCell {
  key: string;
  cat: (typeof COVERAGE_CATS)[number];
  cohort: number;
  status: Health;
  reason: string;
  target: number;
  total: number;
  entries: { year: number; grade: number; title: string; state: 'received' | 'current' | 'planned' }[];
  inPlan: number;
  dismissed: { reason: string; by: string; at: number } | null;
}

export function assessCoverage(p: Plan, catId: string, c: number, nowYear: number): CoverageCell {
  const cat = COVERAGE_CATS.find((x) => x.id === catId)!;
  const group = COVERAGE_GROUPS.find((g) => g.id === cat.group)!;
  const span = 13 - p.settings.entryGrade;
  const years = cohortYears(p, c);
  const inPlan = years.filter((y) => y.inPlan);
  const target = Math.max(1, Math.round((group.target * inPlan.length) / span));
  const entries: CoverageCell['entries'] = [];
  for (const y of inPlan)
    for (const s of teachingOf(p, y.year - p.settings.startYear))
      if (s.tags.includes(catId)) entries.push({ year: y.year, grade: y.grade, title: s.title, state: y.year < nowYear ? 'received' : y.year === nowYear ? 'current' : 'planned' });
  const total = entries.length;
  const planned = entries.filter((e) => e.state === 'planned').length;
  const distinct = [...new Set(entries.map((e) => e.year))].sort();
  const remaining = inPlan.filter((y) => y.year > nowYear).length;
  const label = (y: number) => yearLabel(y, 0);
  let status: Health = 'healthy';
  let reason: string;
  if (total === 0) {
    status = 'gap';
    reason = cat.name + ' doesn’t come up in any of their ' + inPlan.length + ' years in this plan. No series carries the tag.';
  } else if (total < target) {
    status = remaining === 0 ? 'gap' : 'attention';
    reason = cat.name + ' comes up ' + total + (total === 1 ? ' time' : ' times') + (remaining === 0 ? ' before they graduate' : ', even counting what is still scheduled') + '. The target across their ' + inPlan.length + ' years here is ' + target + '.';
  } else if (distinct.length === 1) {
    status = 'attention';
    reason = 'All ' + total + ' touches fall in ' + label(distinct[0]) + '. Nothing before it and nothing after, so anyone who joined late or left early misses it.';
  } else if (planned === 0 && distinct[distinct.length - 1] <= nowYear - 3) {
    status = 'attention';
    reason = 'Last covered in ' + label(distinct[distinct.length - 1]) + ' and nothing is scheduled before they graduate. Three years is longer than this plan means to leave a category.';
  } else {
    reason = total + ' touches across ' + distinct.length + ' years — ' + listOf(distinct.map(label)) + '. Target is ' + target + '.';
  }
  const key = 'cov:' + catId + '|' + c;
  const dis = status !== 'healthy' ? (p.dismissed.find((d) => d.id === key) ?? null) : null;
  return { key, cat, cohort: c, status, reason, target, total, entries, inPlan: inPlan.length, dismissed: dis ? { reason: dis.reason, by: dis.by, at: dis.at } : null };
}

/* ── checks ──────────────────────────────────────────────────────────── */
export interface PlanCheck {
  id: string;
  title: string;
  status: Health;
  reason: string;
  /** A one-tap fix, applied through the normal undoable save. */
  fix?: { label: string; apply: (p: Plan, newId: () => string) => void };
  /** Where to look. */
  item?: string;
  year?: number;
}

const VOL_LANES = ['events', 'trips', 'outreach', 'vtrain', 'vcare'];
const PAR_LANES = ['parents', 'events', 'trips'];
const LOAD_MAX = 3;

export const norm = (t: string) => t.trim().toLowerCase();

export function planChecks(p: Plan, nowYear: number, monthNow: number): PlanCheck[] {
  const out: PlanCheck[] = [];
  const laneName = (id: string) => p.lanes.find((l) => l.id === id)?.name ?? id;
  const sy = p.settings.startYear;

  /* Teaching weeks against gathering nights, year by year. */
  for (let y = 0; y < 7; y++) {
    const target = nightsOf(p, y).length;
    const series = teachingOf(p, y);
    const w = series.reduce((n, s) => n + s.size, 0);
    const conf = series.filter((s) => s.status === 'confirmed').reduce((n, s) => n + s.size, 0);
    const status: Health = w >= target * 0.9 ? 'healthy' : w >= target * 0.4 ? 'attention' : 'gap';
    const pick = SUGGEST.find((c) => !namedInPlan(p, c.names) && !p.dismissed.some((d) => d.id === 'sug:teach|' + norm(c.title)));
    out.push({
      id: 'weeks|' + y,
      year: y,
      title: 'Teaching weeks, ' + yearLabel(sy, y),
      status,
      reason:
        w > target
          ? w + ' weeks of series won’t fit in ' + target + ' nights; the last ' + (w - target) + ' fall off the year.'
          : status === 'healthy'
            ? w + ' of ' + target + ' nights taught' + (conf < w ? ', ' + (w - conf) + ' still draft.' : ', all confirmed.')
            : w === 0
              ? 'No teaching is planned for ' + yearLabel(sy, y) + '. All ' + target + ' nights are open.'
              : w + ' of ' + target + ' nights have a series. ' + (target - w) + ' are open.',
      fix:
        status !== 'healthy' && w <= target && pick
          ? {
              label: 'Add ' + pick.title + ' (' + Math.min(pick.weeks, target - w) + ' wks) as a draft',
              apply: (x, id) =>
                void x.items.push({ id: id(), lane: 'teach', year: y, title: pick.title, kind: 'series', size: Math.min(pick.weeks, target - w), status: 'draft', notes: '', tags: pick.tags, refs: pick.cites.join('; '), suggested: { reason: 'Added from Plan checks: ' + yearLabel(sy, y) + ' had ' + w + ' of ' + target + ' nights taught, and no series in the plan covers ' + pick.names[0] + '.', rule: 'teaching-gap', cites: pick.cites } })
            }
          : undefined
    });
  }

  /* Goals: something in the lanes they name has to support them. */
  for (const g of p.items.filter((i) => i.kind === 'goal')) {
    const sup = g.supports ?? [];
    const conf = p.items.filter((i) => i.year === g.year && i.id !== g.id && i.status === 'confirmed' && sup.includes(i.lane));
    const drafts = p.items.filter((i) => i.year === g.year && i.id !== g.id && i.status === 'draft' && sup.includes(i.lane));
    const status: Health = !sup.length ? 'gap' : conf.length ? 'healthy' : drafts.length ? 'attention' : 'gap';
    out.push({
      id: 'goal|' + g.id,
      item: g.id,
      year: g.year,
      title: 'Goal: ' + g.title,
      status,
      reason: !sup.length
        ? 'No lanes are named as supporting this goal, so nothing in the plan is measured against it.'
        : status === 'healthy'
          ? 'Supported in ' + yearLabel(sy, g.year) + ' by ' + listOf(conf.map((i) => i.title)) + '.'
          : status === 'attention'
            ? 'Only drafts support it in ' + yearLabel(sy, g.year) + ': ' + listOf(drafts.map((i) => i.title)) + '.'
            : 'Nothing in ' + listOf(sup.map(laneName)) + ' is planned for ' + yearLabel(sy, g.year) + '.'
    });
  }

  /* Year one: what has run should be debriefed. */
  const ranY1 = nowYear > sy ? p.items.filter((i) => i.year === 0) : p.items.filter((i) => i.year === 0 && i.month !== undefined && i.month < monthNow);
  const noDebrief = ranY1.filter((i) => i.status === 'confirmed' && ['series', 'event', 'trip'].includes(i.kind) && !i.debrief);
  out.push({
    id: 'debrief',
    year: 0,
    title: 'Debriefs for year one',
    status: noDebrief.length ? 'attention' : 'healthy',
    reason: noDebrief.length ? noDebrief.length + (noDebrief.length === 1 ? ' item that has run has' : ' items that have run have') + ' no debrief: ' + listOf(noDebrief.map((i) => i.title)) + '. Next year’s copy will have nothing to learn from.' : 'Everything that has run in year one has a debrief.'
  });

  /* The same series twice means a student here for both sits through it twice. */
  const byTitle = new Map<string, { t: string; ys: number[]; id: string }>();
  for (const s of p.items.filter((i) => i.kind === 'series')) {
    const b = byTitle.get(norm(s.title)) ?? { t: s.title, ys: [], id: s.id };
    b.ys.push(s.year);
    b.id = s.id;
    byTitle.set(norm(s.title), b);
  }
  const reps = [...byTitle.values()].filter((b) => b.ys.length > 1 && !/core truths/i.test(b.t));
  out.push({
    id: 'repeat',
    title: 'Repeated series',
    status: reps.length ? 'attention' : 'healthy',
    item: reps[0]?.id,
    reason: reps.length ? reps.map((b) => b.t + ' in ' + listOf(b.ys.map((y) => yearLabel(sy, y)))).join('; ') + '. A student here for both sits through it twice.' : 'No series runs more than once, apart from core truths, which repeat by design.'
  });

  /* Holy days that land on a gathering night. */
  if (p.settings.liturgical) {
    const clashes: string[] = [];
    for (let y = 0; y < 3; y++) {
      const nights = new Set(nightsOf(p, y));
      for (const h of holyDaysBetween(sy + y + '-08-01', sy + y + 1 + '-07-31')) if (h.kind === 'day' && p.holyDays[h.id] !== false && nights.has(h.date)) clashes.push(h.name + ' ' + h.date.slice(0, 4));
    }
    out.push({
      id: 'church',
      title: 'Church year on gathering nights',
      status: clashes.length ? 'attention' : 'healthy',
      reason: clashes.length ? listOf(clashes) + ' fall on a gathering night in the next three years. Decide now whether you meet, merge with the church, or cancel.' : 'No holy day lands on a gathering night in the next three years.'
    });
  }

  /* Year-one drafts — the plan the app shows is confirmed only. */
  const y1Drafts = p.items.filter((i) => i.year === 0 && i.status === 'draft' && !i.suggested);
  out.push({
    id: 'y1drafts',
    year: 0,
    title: 'Unconfirmed in year one',
    status: y1Drafts.length ? 'attention' : 'healthy',
    reason: y1Drafts.length ? listOf(y1Drafts.map((i) => i.title)) + (y1Drafts.length === 1 ? ' is' : ' are') + ' still a draft. Families and leaders only see confirmed items.' : 'Everything in year one is confirmed.',
    fix: y1Drafts.length ? { label: 'Confirm ' + y1Drafts.length + (y1Drafts.length === 1 ? ' draft' : ' drafts'), apply: (x) => void x.items.forEach((i) => i.year === 0 && i.status === 'draft' && !i.suggested && (i.status = 'confirmed')) } : undefined
  });

  const sugg = p.items.filter((i) => i.suggested && i.status === 'draft');
  out.push({
    id: 'suggested',
    title: 'Suggestions waiting',
    status: sugg.length ? 'attention' : 'healthy',
    item: sugg[0]?.id,
    reason: sugg.length ? sugg.length + ' suggested ' + (sugg.length === 1 ? 'draft hasn’t' : 'drafts haven’t') + ' been reviewed: ' + listOf(sugg.map((i) => i.title)) + '.' : 'No suggested drafts are waiting.'
  });

  /* Load: three or more in a month for volunteers or for parents. */
  for (const [kind, lanes] of [['Volunteer', VOL_LANES], ['Parent', PAR_LANES]] as const) {
    const items = p.items.filter((i) => i.year === 0 && lanes.includes(i.lane) && i.kind !== 'recurring' && i.kind !== 'goal');
    const byMonth = new Map<number, PlanItem[]>();
    for (const i of items) if (i.month !== undefined) byMonth.set(i.month, [...(byMonth.get(i.month) ?? []), i]);
    const over = [...byMonth.entries()].filter(([, l]) => l.length >= LOAD_MAX);
    const undated = items.filter((i) => i.month === undefined);
    out.push({
      id: 'load|' + kind,
      year: 0,
      title: kind + ' load, year one',
      status: over.length ? 'attention' : 'healthy',
      reason:
        (over.length ? over.map(([m, l]) => MONTHS_FROM_AUG[m] + ' has ' + l.length + ': ' + listOf(l.map((i) => i.title))).join('; ') + '.' : 'No month asks ' + kind.toLowerCase() + 's for three or more things.') +
        (undated.length ? ' Not counted (no month): ' + listOf(undated.map((i) => i.title)) + '.' : ''),
      fix: over.length
        ? {
            label: 'Move ' + over[0][1][over[0][1].length - 1].title + ' to a lighter month',
            apply: (x) => {
              const it = x.items.find((i) => i.id === over[0][1][over[0][1].length - 1].id);
              if (!it || it.month === undefined) return;
              for (let d = 1; d < 12; d++)
                for (const m of [it.month + d, it.month - d])
                  if (m >= 0 && m < 12 && (byMonth.get(m)?.length ?? 0) < LOAD_MAX - 1) {
                    it.month = m;
                    return;
                  }
            }
          }
        : undefined
    });
  }
  return out;
}

/* ── suggestions ─────────────────────────────────────────────────────── */
export const SUGGEST = [
  { names: ['Acts'], title: 'Acts: The Church Begins', weeks: 8, cites: ['Acts 1–2', 'Acts 9', 'Acts 15'], tags: ['acts', 'church', 'spirit'] },
  { names: ['Exile', 'Daniel', 'Ezra', 'Nehemiah'], title: 'Exile & Return', weeks: 6, cites: ['Daniel 1', 'Ezra 3', 'Nehemiah 8'], tags: ['prophets', 'god'] },
  { names: ['Psalm'], title: 'Psalms: Learning to Pray', weeks: 6, cites: ['Psalm 1', 'Psalm 23', 'Psalm 51', 'Psalm 139'], tags: ['psalms', 'prayer'] },
  { names: ['Romans'], title: 'Romans: Grace Explained', weeks: 8, cites: ['Romans 3:21–26', 'Romans 8', 'Romans 12:1–2'], tags: ['paul', 'grace'] },
  { names: ['Sermon on the Mount', 'Matthew'], title: 'Sermon on the Mount', weeks: 6, cites: ['Matthew 5–7'], tags: ['gospels', 'jesus'] },
  { names: ['John'], title: 'John: Signs and Belief', weeks: 8, cites: ['John 2:1–11', 'John 11', 'John 20:30–31'], tags: ['gospels', 'jesus'] }
];

const namedInPlan = (p: Plan, names: string[]) => p.items.some((i) => i.kind === 'series' && names.some((n) => (norm(i.title) + ' ' + norm(i.refs ?? '')).includes(n.toLowerCase())));

export interface Suggestion {
  id: string;
  year: number;
  lane: string;
  title: string;
  kind: PlanItem['kind'];
  size: number;
  reason: string;
  rule: string;
  cites: string[];
  tags: string[];
  month?: number;
}

/** Drafts the plan's own gaps call for. A teaching gap in the next three
 *  years gets a series no series in the plan names yet; a confirmed yearly
 *  rhythm with nothing next year is offered for next year, with what last
 *  year's debrief said to change. */
export function suggestions(p: Plan): Suggestion[] {
  const out: Suggestion[] = [];
  const sy = p.settings.startYear;
  const used = new Set<string>();
  for (let y = 0; y < 3; y++) {
    const target = nightsOf(p, y).length;
    const w = teachingOf(p, y).reduce((n, s) => n + s.size, 0);
    if (w >= target * 0.75) continue;
    for (const c of SUGGEST) {
      if (used.has(c.title) || namedInPlan(p, c.names)) continue;
      used.add(c.title);
      out.push({ id: 'sug:teach|' + norm(c.title), year: y, lane: 'teach', title: c.title, kind: 'series', size: Math.min(c.weeks, Math.max(3, target - w)), reason: yearLabel(sy, y) + ' has ' + w + ' of ' + target + ' nights taught, and no series in the plan names ' + c.names[0] + ' yet.', rule: 'teaching-gap', cites: c.cites, tags: c.tags });
      break;
    }
  }
  for (const it of p.items.filter((i) => i.year === 0 && i.status === 'confirmed' && (i.kind === 'recurring' || i.kind === 'event' || i.kind === 'trip'))) {
    if (p.items.some((x) => x.year === 1 && norm(x.title) === norm(it.title))) continue;
    out.push({ id: 'sug:rhythm|' + norm(it.title), year: 1, lane: it.lane, title: it.title, kind: it.kind, size: it.size, month: it.month, reason: 'It ran in ' + yearLabel(sy, 0) + ' and nothing is planned for ' + yearLabel(sy, 1) + '.' + (it.debrief?.change ? ' Last time: “' + it.debrief.change + '”' : ''), rule: 'yearly-rhythm', cites: [], tags: it.tags });
  }
  return out.filter((s) => !p.dismissed.some((d) => d.id === s.id));
}

/* ── publish ─────────────────────────────────────────────────────────── */
export const signature = (i: PlanItem) => [i.title, i.lane, i.month ?? '', i.size].join('|');

/** What the app shows is year one's confirmed items. */
export function publishDiff(p: Plan) {
  const live = p.items.filter((i) => i.year === 0 && i.status === 'confirmed');
  const was = p.published?.items ?? {};
  const added = live.filter((i) => !(i.id in was));
  const changed = live.filter((i) => i.id in was && was[i.id] !== signature(i));
  const removed = Object.keys(was)
    .filter((id) => !live.some((i) => i.id === id))
    .map((id) => ({ id, title: was[id].split('|')[0] }));
  const heldDrafts = p.items.filter((i) => i.status === 'draft').length;
  const heldLater = p.items.filter((i) => i.year > 0 && i.status === 'confirmed').length;
  return { live, added, changed, removed, heldDrafts, heldLater, dirty: added.length + changed.length + removed.length > 0 };
}
