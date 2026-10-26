/* PLANS & BILLING — four candidate ways to charge a church, priced so the
   calculator can compare them honestly at any ministry size. annual(ctx)
   is the church's yearly cost in dollars over { students, leaders,
   seasons }; change a number here and the calculator, the comparison and
   the recommendation all move with it.

   VENDOR-ONLY. No ministry role — the Organization Owner included — ever
   sees a price: this is read on the founder's own admin (/vendor), never
   in the ministry app. The model is still to be tested on real churches. */

export interface PricingContext {
  students: number;
  /** Leaders with a login. Students, parents and visitors are never a seat. */
  leaders: number;
  /** Scoring seasons a year. */
  seasons: number;
}

export interface PricingModel {
  id: 'band' | 'perStudent' | 'perSeason' | 'perLeader';
  label: string;
  short: string;
  how: string;
  good: string;
  bad: string;
  annual: (c: PricingContext) => number;
  detail: (c: PricingContext) => string;
}

export const SIZE_BANDS = [
  { upTo: 50, price: 399 },
  { upTo: 150, price: 699 },
  { upTo: 400, price: 1199 },
  { upTo: Infinity, price: 1899 }
] as const;
export const bandFor = (students: number) => SIZE_BANDS.find((b) => students <= b.upTo) ?? SIZE_BANDS[SIZE_BANDS.length - 1];

export const PRICING_MODELS: PricingModel[] = [
  {
    id: 'band',
    label: 'Flat annual, by size',
    short: 'Size band',
    how: 'One yearly price per band of students. Nothing changes when the group grows inside its band.',
    good: 'Predictable. Fits a youth budget set once a year, and never makes a pastor think twice about inviting one more kid.',
    bad: 'A church at the top of a band pays the same as one at the bottom.',
    annual: (c) => bandFor(c.students).price,
    detail: (c) => {
      const b = bandFor(c.students);
      return b.upTo === Infinity ? '400+ students' : 'up to ' + b.upTo + ' students';
    }
  },
  {
    id: 'perStudent',
    label: 'Per student, per year',
    short: 'Per student',
    how: '$9 a student a year, 25-student minimum, billed once.',
    good: 'Scales exactly with size. A tiny group pays almost nothing.',
    bad: 'The price goes up every time the ministry grows — the app charges for the thing it exists to cause.',
    annual: (c) => Math.max(c.students, 25) * 9,
    detail: (c) => Math.max(c.students, 25) + ' × $9'
  },
  {
    id: 'perSeason',
    label: 'Per season',
    short: 'Per season',
    how: '$279 a season, unlimited students. Most ministries run two.',
    good: 'Matches how ministries actually think — in seasons, not years. Easy to try once.',
    bad: 'Revenue drops in a summer nobody runs a season, and the pastor decides your income.',
    annual: (c) => c.seasons * 279,
    detail: (c) => c.seasons + ' × $279'
  },
  {
    id: 'perLeader',
    label: 'Per leader seat, monthly',
    short: 'Per seat',
    how: '$6 a month for every leader with a login. Students, parents and visitors are always free.',
    good: 'Familiar SaaS shape. Grows with the volunteer team, not the kids.',
    bad: 'Punishes the ministry for recruiting volunteers, and someone will start sharing a login.',
    annual: (c) => c.leaders * 6 * 12,
    detail: (c) => c.leaders + ' seats × $6 × 12'
  }
];

export const RECOMMENDED_MODEL: PricingModel['id'] = 'band';

export const RECOMMENDATION = {
  title: 'Charge the flat annual band',
  why: 'A youth budget is set once a year, so a per-student invoice is the one shape a pastor cannot approve without going back to the board. It is also the wrong incentive: this app exists to get more kids in the room, and per-student pricing quietly charges for that. Bands keep the price honest at every size, and a church that grows into the next band did so over a season, with the budget cycle to absorb it. Students, parents and visitors are never a seat.'
};

export interface PricingPlan {
  id: 'starter' | 'ministry' | 'network';
  label: string;
  priceLabel: string;
  who: string;
  recommended?: boolean;
  includes: string[];
  /** Where a feature flag hangs. */
  limits: string[];
}

/** What each band includes. */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    label: 'Starter',
    priceLabel: '$399 / year',
    who: 'Up to 50 students · one season at a time',
    includes: ['Check-in and the points board', 'One season, up to 4 squads', 'The huddle sheet', 'Weekly recap report', 'Parent board link'],
    limits: ['No custom reports', 'No Planning Center sync', 'Email support']
  },
  {
    id: 'ministry',
    label: 'Ministry',
    priceLabel: '$699 / year',
    who: 'Up to 150 students · the common case',
    recommended: true,
    includes: ['Everything in Starter', 'Unlimited seasons and squads', 'The report builder', 'Planning Center connection', 'Scheduled deliveries to any audience', 'Small group guides and media'],
    limits: ['One campus']
  },
  {
    id: 'network',
    label: 'Network',
    priceLabel: '$1,199+ / year',
    who: '150+ students, or more than one campus',
    includes: ['Everything in Ministry', 'Multiple campuses under one church', 'Cross-campus reporting', 'Dedicated onboarding call', 'Season templates shared across campuses'],
    limits: []
  }
];

/** The plan a ministry of this size lands in under the size bands. */
export const planFor = (students: number): PricingPlan['id'] => (students <= 50 ? 'starter' : students <= 150 ? 'ministry' : 'network');

export const annualFor = (id: PricingModel['id'], c: PricingContext) => Math.round(PRICING_MODELS.find((m) => m.id === id)!.annual(c));

export const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/** The calculator's starting point: the handoff's example ministry. */
export const EXAMPLE_MINISTRY: PricingContext = { students: 96, leaders: 14, seasons: 2 };

/* ── who is the vendor ─────────────────────────────────────────────── */

/** VENDOR_EMAILS: comma-separated sign-in emails of the people who may see
 *  pricing (the founder, perhaps a partner). Nobody else, ever. */
export function vendorEmails(env: string | undefined): Set<string> {
  return new Set(
    (env ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'))
  );
}
export const isVendorEmail = (email: string | null | undefined, env: string | undefined) => !!email && vendorEmails(env).has(email.trim().toLowerCase());
