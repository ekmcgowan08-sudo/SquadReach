/* ─────────────────────────────────────────────────────────────────────────
   DEMO MINISTRY — "Grace Community Students", week 9 of a nine-week fall
   season, exactly as the design shows it. This is what the app boots into
   with no Supabase project configured. Real data comes from the ministry's
   own setup; nothing here is read in Supabase mode.
   ───────────────────────────────────────────────────────────────────────── */
import type {
  AudienceId, ChatMessage, ChatThread, HuddleState, LedgerEntry, MinistryData, Rsvp, Student, StudentBadge
} from '@/lib/types/model';

const MIN = 60_000;
const DAY = 86_400_000;

/* [name, team, grade, flags]  flags: c = captain, g = guest, n = new in the directory */
const ROSTER_ROWS: [string, string, string, string][] = [
  ['Isaac Lindsey', 'blue', '12', 'c'],
  ['Zoe Gillespie', 'blue', '10', 'c'],
  ['Jack Ranard', 'blue', '7', 'c'],
  ['Ozzie Bates', 'blue', '12', ''],
  ['Jacob Dela Llana', 'blue', '12', ''],
  ['Janelle Owen', 'blue', '6', ''],
  ['Jullian Pace', 'blue', '7', ''],
  ['Emma Kalesia', 'blue', '8', ''],
  ['Emmalyn Dayvolt', 'blue', '8', ''],
  ['Ella Rynard', 'blue', '8', ''],
  ['Ryan Madras', 'blue', '7', ''],
  ['Jean Kormelink', 'blue', '6', ''],
  ['Alex Herrera', 'blue', '8', ''],
  ['Natalie Kierspel', 'blue', '10', ''],
  ['Addison Kruse', 'blue', '10', 'g'],
  ['Abbie Stephens', 'blue', '11', ''],
  ['Ellison Kruckenberg', 'blue', '12', ''],
  ['Sofia Dela Llana', 'blue', '8', ''],
  ['Shawn Brown', 'blue', '7', 'g'],
  ['Adalynn Williams', 'blue', '6', ''],
  ['Peyton Rice', 'blue', '6', ''],
  ['Kendall Peerman', 'blue', '6', 'gn'],
  ['Ayla Martin', 'blue', '8', 'g'],
  ['Kate Edwards', 'blue', '11', 'gn'],
  ['Graham Marlow', 'blue', '11', 'g'],
  ['Brooklyn Kruse', 'blue', '7', ''],
  ['Hallie Bridgewater', 'blue', '6', 'g'],
  ['Jimel Johnson', 'blue', '12', 'gn'],
  ['Ava Collins', 'blue', '8', 'g'],
  ['Lauren Schessele', 'blue', '8', 'g'],
  ['Adalyn Hartweck', 'blue', '8', 'g'],
  ['Savannah Heldt', 'blue', '11', ''],
  ['Ellison Reid', 'yellow', '8', 'c'],
  ['Luke Jarvis', 'yellow', '9', 'c'],
  ['Zoe Smith', 'yellow', '9', 'c'],
  ['Jay Kormelink', 'yellow', '7', ''],
  ['Emmitt Bates', 'yellow', '11', ''],
  ['Dawson Baize', 'yellow', '11', ''],
  ['Nathaniel Storey', 'yellow', '8', ''],
  ['Jordan Zachary', 'yellow', '7', ''],
  ['Cohen Pennington', 'yellow', '7', ''],
  ['Ryan Logsdon', 'yellow', '8', ''],
  ['David Spencer', 'yellow', '12', ''],
  ['Makayla Weyer', 'yellow', '8', ''],
  ['Hudson Kruckenberg', 'yellow', '8', ''],
  ['Emmylee Smith', 'yellow', '12', ''],
  ['Jaxson Kruckenberg', 'yellow', '7', ''],
  ['Faith Green', 'yellow', '8', ''],
  ['Michael Mathias', 'yellow', '7', 'gn'],
  ['Parker Holdeman', 'yellow', '8', 'g'],
  ['Wyatt Gabel', 'yellow', '8', 'gn'],
  ['Luca Farless', 'yellow', '8', 'gn'],
  ['Josie Howlette', 'yellow', '8', 'gn'],
  ['June Kormelink', 'yellow', '9', ''],
  ['Ellie Thompson', 'yellow', '8', 'gn'],
  ['Mia Jones', 'yellow', '8', 'gn'],
  ['Ella Ewers', 'yellow', '8', 'gn'],
  ['Harper Banning', 'yellow', '9', 'gn'],
  ['Hattie Giannini', 'yellow', '8', 'gn'],
  ['Jack Blanton', 'yellow', '8', 'gn'],
  ['Melanie Russell', 'red', '11', 'c'],
  ['Lucian Sargeant', 'red', '12', 'c'],
  ['Shealeigh Frank', 'red', '12', ''],
  ['Wyatt Price', 'red', '8', ''],
  ['Vivan Pillow', 'red', '8', ''],
  ['Paige Neireiter', 'red', '8', ''],
  ['Scarlette Minniear', 'red', '8', ''],
  ['Landon Sargeant', 'red', '12', ''],
  ['Isaac Smith', 'red', '7', ''],
  ['Noah Godshall', 'red', '7', ''],
  ['Alannah Carawan', 'red', '11', ''],
  ['Hannah Duff', 'red', '7', ''],
  ['Amelia Duff', 'red', '8', ''],
  ['Ryley Duff', 'red', '6', ''],
  ['Layla Irwin', 'red', '10', ''],
  ['Alice Irwin', 'red', '9', ''],
  ['Erica Rodgers', 'red', '11', ''],
  ['Joshua Garrett', 'red', '8', 'gn'],
  ['Justice Holben', 'red', '11', ''],
  ['Mark Russell', 'red', '6', ''],
  ['Graham Bradley', 'red', '6', ''],
  ['Kingsley Zhang', 'red', '10', 'gn'],
  ['Eli Edwards', 'red', '12', 'gn'],
  ['Rhylee Sargeant', 'red', '7', ''],
];

export const ROSTER: Student[] = ROSTER_ROWS.map(([name, team, grade, f], i) => ({
  id: 'st' + (i + 1),
  name,
  team,
  grade,
  ...(f.includes('c') ? { captain: true } : {}),
  ...(f.includes('g') ? { guest: true } : {}),
  ...(f.includes('n') ? { newInDb: true } : {})
}));

/** FNV-style string hash — deterministic demo numbers, same as the design. */
export function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export const STUDENT_BADGES: StudentBadge[] = [
  { name: 'Ellison Reid', team: 'yellow', attendStreak: 9, bibleStreak: 21 },
  { name: 'Luke Jarvis', team: 'yellow', attendStreak: 9, bibleStreak: 9 },
  { name: 'Melanie Russell', team: 'red', attendStreak: 8, bibleStreak: 12 },
  { name: 'Isaac Smith', team: 'red', attendStreak: 6, bibleStreak: 14 },
  { name: 'Janelle Owen', team: 'blue', attendStreak: 9, bibleStreak: 8 },
  { name: 'Wyatt Price', team: 'red', attendStreak: 2, bibleStreak: 1 }
];

/** What each student carried in before tonight — the design's numbers. */
function seedStudentPoints(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ROSTER) {
    let h = 0;
    for (let i = 0; i < r.name.length; i++) h = (h * 31 + r.name.charCodeAt(i)) % 99991;
    let pts = 350 + (h % 44) * 60;
    if (r.captain) pts += 850;
    if (r.guest) pts -= 220;
    const b = STUDENT_BADGES.find((x) => x.name === r.name);
    if (b) pts += b.attendStreak * 55 + b.bibleStreak * 20;
    out[r.name] = Math.max(0, pts);
  }
  return out;
}

/* Category totals per squad at the start of tonight, from the design. The
   ledger below is built so these are exactly what the board shows. */
const SEASON_TOTALS: Record<string, Record<string, number>> = {
  yellow: { general: 2050, spiritwear: 680, bible: 0, verses: 40, visitors: 5375, games: 0, media: 0 },
  red: { general: 0, spiritwear: 0, bible: 0, verses: 0, visitors: 2900, games: 0, media: 0 },
  blue: { general: 50, spiritwear: 10, bible: 0, verses: 0, visitors: 1650, games: 0, media: 0 },
  green: { general: 50, spiritwear: 30, bible: 0, verses: 0, visitors: 0, games: 0, media: 0 }
};

function seedLedger(now: number): LedgerEntry[] {
  /* Tonight's recent changes — the four rows on Home. */
  const recent: LedgerEntry[] = [
    { id: 'seed-r1', team: 'red', cat: 'visitors', amount: 1600, by: 'Coach Chris', why: 'Shealeigh Frank · new friend', at: now - 4 * MIN, status: 'approved', student: 'Shealeigh Frank' },
    { id: 'seed-r2', team: 'yellow', cat: 'general', amount: 50, by: 'Pastor Mike', why: 'Ellison Reid · attended', at: now - 11 * MIN, status: 'approved', student: 'Ellison Reid' },
    { id: 'seed-r3', team: 'blue', cat: 'spiritwear', amount: 30, by: 'Coach Kyle', why: 'Jack Ranard · league shirt', at: now - 22 * MIN, status: 'approved', student: 'Jack Ranard' },
    { id: 'seed-r4', team: 'yellow', cat: 'visitors', amount: -400, by: 'Pastor Mike · reversal', why: 'duplicate entry', at: now - 35 * MIN, status: 'approved' }
  ];
  /* Weeks 1–8 carried in as one row per squad × category, so the ledger
     still sums to the board. */
  const carried: LedgerEntry[] = [];
  for (const [team, cats] of Object.entries(SEASON_TOTALS)) {
    for (const [cat, total] of Object.entries(cats)) {
      const tonight = recent.filter((e) => e.team === team && e.cat === cat).reduce((n, e) => n + e.amount, 0);
      const amount = total - tonight;
      if (!amount) continue;
      carried.push({ id: 'seed-c-' + team + '-' + cat, team, cat, amount, by: 'Weeks 1–8', why: 'carried in from earlier weeks', at: now - 8 * DAY, status: 'approved' });
    }
  }
  /* Two coach submissions waiting on the youth pastor. */
  const pending: LedgerEntry[] = [
    { id: 'seed-p1', team: 'blue', cat: 'visitors', amount: 800, by: 'Coach Kyle', why: 'Kendall Peerman brought a new friend', at: now - 6 * MIN, status: 'pending', student: 'Kendall Peerman' },
    { id: 'seed-p2', team: 'red', cat: 'general', amount: 100, by: 'Coach Mario', why: 'Wyatt Price · community volunteer x2', at: now - 9 * MIN, status: 'pending', student: 'Wyatt Price' }
  ];
  return [...pending, ...recent, ...carried];
}

const ALL_AUDIENCES: AudienceId[] = ['members', 'captains', 'coaches', 'scorekeeper', 'leaders', 'parents', 'admins'];

export const RUN_SHEET_DEFAULT = [
  { id: 'rs1', time: '6:15pm', label: 'Huddle', where: 'Room 204', who: 'Everyone serving', detail: 'Thirty minutes, whole team in a circle. Tonight’s plan, who is missing, and the one thing we are watching for.' },
  { id: 'rs2', time: '6:45pm', label: 'Doors', where: 'Lobby + gym', who: 'Everyone in place', detail: 'In position five minutes before they arrive. Greeters on both doors, coaches on the floor with their squad. Hang out — this is the part they remember.' },
  { id: 'rs3', time: '7:05pm', label: 'Split to groups', where: '4 rooms', who: 'Coaches', detail: 'Age-appropriate and gender-divided. Walk them over, do not send them.' },
  { id: 'rs4', time: '7:15pm', label: 'Lesson', where: 'Worship Center', who: 'Pastor Mike', detail: 'Ephesians 2:1–10 · “Alive with Christ”. Coaches sit with their squad, not at the back.' },
  { id: 'rs5', time: '7:45pm', label: 'Games', where: 'Main gym', who: 'Scorekeeper', detail: 'Pipeline relay. Coaches run their own squad line; the scorekeeper owns the clock and the board.' },
  { id: 'rs6', time: '8:15pm', label: 'Small group', where: 'Your room', who: 'Coaches', detail: 'The guide is under Season › Small groups. Six questions — you will not get to all six, and that is fine.' },
  { id: 'rs7', time: '8:45pm', label: 'Send home', where: 'Doors + lot', who: 'Everyone', detail: 'Nobody walks out alone. Lot coverage until the last car is gone.' },
  { id: 'rs8', time: '8:50pm', label: 'Debrief · pray · out', where: 'Room 204', who: 'Everyone serving', detail: 'Five to ten minutes. What worked, who needs following up on, pray, go home.', debrief: true }
];

export const DEFAULT_READY = [
  { id: 'slides', label: 'Slides loaded and cued', who: 'Tech' },
  { id: 'bumper', label: 'Bumper video downloaded', who: 'Tech' },
  { id: 'guides', label: 'Small group guides printed', who: 'You' },
  { id: 'game', label: 'Game supplies in the closet', who: 'Scorekeeper' },
  { id: 'live', label: 'Ministry time activities set', who: 'You' },
  { id: 'snack', label: 'Snack table stocked', who: 'Beth N.' }
];

function seedHuddle(now: number): HuddleState {
  return {
    runSheet: RUN_SHEET_DEFAULT.map((it) => ({ ...it, assignedTo: null, notifiedAt: null })),
    runIdx: 0,
    runDone: {},
    runAdvancedAt: now - 7 * MIN,
    crew: [
      { id: 'c1', name: 'Chris Alder', job: 'Coach · Yellow', post: 'Room 2 · 6th–8th boys', team: 'yellow', sendHome: 'West doors' },
      { id: 'c2', name: 'Dana Boyd', job: 'Coach · Yellow', post: 'Room 3 · 6th–8th girls', team: 'yellow', sendHome: 'West doors' },
      { id: 'c3', name: 'Marcus Hall', job: 'Coach · Red', post: 'Room 1 · 9th–12th boys', team: 'red', sendHome: 'Parking lot' },
      { id: 'c4', name: 'Priya Raman', job: 'Coach · Blue', post: 'Room 4 · 9th–12th girls', team: 'blue', sendHome: 'Lobby' },
      { id: 'c5', name: 'Ty Winslow', job: 'Coach · Green', post: 'Gym floor · roaming', team: 'green', sendHome: 'Parking lot' },
      { id: 'c6', name: 'Mike Torres', job: 'Youth pastor', post: 'Worship Center · lesson', team: null, sendHome: 'Lobby' },
      { id: 'c7', name: 'Renee Boyd', job: 'Admin', post: 'Lobby · kiosk + forms', team: null, sendHome: 'Lobby' },
      { id: 'c8', name: 'Sam Okafor', job: 'Scorekeeper', post: 'Main gym · clock + board', team: null, sendHome: 'Gym doors' },
      { id: 'c9', name: 'Ava Lin', job: 'Media', post: 'Gym floor · film + photos', team: null, sendHome: 'Gym doors' },
      { id: 'c10', name: 'Beth Naylor', job: 'Small group leader', post: 'Room 3 · with Dana', team: 'yellow', sendHome: 'West doors' },
      { id: 'c11', name: 'Jordan Pike', job: 'Greeter', post: 'North door', team: null, sendHome: 'North door' }
    ],
    crewState: { c1: 'here', c2: 'here', c3: 'late', c4: 'here', c5: 'out', c6: 'here', c7: 'here', c8: 'here', c9: 'here', c10: 'here' },
    crewAdded: [],
    bench: [
      { id: 'b1', name: 'Luis Ferrer', meta: 'Served 6 of 9 weeks · background check current' },
      { id: 'b2', name: 'Kara Judd', meta: 'Served 3 of 9 weeks · background check current' },
      { id: 'b3', name: 'Tomás Reyes', meta: 'Served 8 of 9 weeks · usually on Sundays' },
      { id: 'b4', name: 'Hannah Pryor', meta: 'New this season · background check expires Dec 1' }
    ],
    openPosts: [{ id: 'op1', post: 'South door · greeter', why: 'Unfilled since the schedule went out' }],
    covered: {},
    subAsks: {},
    note: 'Two 6th grade boys came for the first time last week — Eli Vance and Cam Brooks. Learn their names before they get to the room.',
    debriefNotes: [],
    nightClosed: false,
    ready: DEFAULT_READY.map((r, i) => ({ ...r, done: i === 0 || i === 1 || i === 3 })),
    dismissed: {}
  };
}

const CHAT_THREADS: ChatThread[] = [
  { id: 'all', kind: 'announce', name: 'Grace Students', sub: '84 members', icon: 'ph-fill ph-megaphone', tint: '#3a3860',
    read: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member', 'parent', 'congregation'], post: ['leader', 'owner', 'scorekeeper', 'coach'] },
  { id: 'leaders', kind: 'group', name: 'Leaders & coaches', sub: '11 members', icon: 'ph-fill ph-users-three', tint: '#26404d',
    read: ['leader', 'owner', 'scorekeeper', 'coach'], post: ['leader', 'owner', 'scorekeeper', 'coach'] },
  { id: 'team-blue', kind: 'team', name: 'Blue Squad', sub: '21 members · Blue', icon: 'ph-fill ph-shield-check', tint: '#1e3a8a',
    read: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'], post: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'] },
  { id: 'parents', kind: 'group', name: 'Parent updates', sub: '46 households', icon: 'ph-fill ph-house-line', tint: '#3d3527',
    read: ['leader', 'owner', 'scorekeeper', 'coach', 'parent', 'congregation'], post: ['leader', 'owner', 'scorekeeper', 'coach'] },
  { id: 'dm-mike', kind: 'dm', name: 'Pastor Mike Torres', sub: 'Ministry Leader', tint: '#4c3b6e',
    read: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'], post: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'] },
  { id: 'dm-zoe', kind: 'dm', name: 'Zoe Gillespie', sub: 'Blue · Grade 10 · captain', tint: '#1d4f4a',
    read: ['leader', 'owner', 'scorekeeper', 'coach'], post: ['leader', 'owner', 'scorekeeper', 'coach'] }
];

const CHAT_SEED: Record<string, ChatMessage[]> = {
  all: [
    { id: 'a1', day: 'Yesterday', time: '4:02p', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Week 9 is dodgeball in the west gym. Doors at 6:30, first whistle at 7. Bring a friend — visitor points are doubled all night.' },
    { id: 'a2', day: 'Yesterday', time: '4:03p', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Memory verse for the week is Romans 12:10. It is worth 300 to your squad if you can say it clean.' },
    { id: 'a3', day: 'Today', time: '8:12a', from: 'Carla Sandoval', roleLabel: 'Scorekeeper', tint: '#26404d', text: 'Standings after Week 8 are posted. Blue leads by 1,400 — close enough that check-in alone could flip it.' }
  ],
  leaders: [
    { id: 'l1', day: 'Yesterday', time: '9:41p', from: 'Carla Sandoval', roleLabel: 'Scorekeeper', tint: '#26404d', text: 'Two point requests are sitting in the queue from tonight. Both have photo proof.' },
    { id: 'l2', day: 'Today', time: '7:55a', from: 'Dana Whitfield', roleLabel: 'Coach · Red', tint: '#7f2f2f', text: 'Heads up, I am 15 late tonight. Marcus can run Red warmups until I get there.' },
    { id: 'l3', day: 'Today', time: '8:20a', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Got it. I moved the run sheet so games start at 7:10.' }
  ],
  'team-blue': [
    { id: 'b1', day: 'Yesterday', time: '6:15p', from: 'Isaac Lindsey', roleLabel: 'Captain', tint: '#1e3a8a', text: 'Blue we need bodies at check-in early. Every name is 50 and we lost the week on it last time.' },
    { id: 'b2', day: 'Yesterday', time: '6:31p', from: 'Zoe Gillespie', roleLabel: 'Captain', tint: '#1d4f4a', text: 'I can get four people there by 6:30. Wear blue, it counts for spirit.' },
    { id: 'b3', day: 'Today', time: '7:40a', system: true, text: 'Coach Ramirez pinned tonight’s meeting spot: bleachers, house-left.' }
  ],
  parents: [
    { id: 'p1', day: 'Monday', time: '5:30p', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Wednesday night runs 6:30–8:30. Pickup is in the west lot. Snacks are covered — no money needed.' },
    { id: 'p2', day: 'Today', time: '9:02a', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Fall retreat forms go out Friday. Nothing to do yet, just so it is on your calendar.' }
  ],
  'dm-mike': [
    { id: 'm1', day: 'Yesterday', time: '8:04p', from: 'Pastor Mike Torres', roleLabel: 'Ministry Leader', tint: '#4c3b6e', text: 'Thanks for covering the door last week. That was a real help.' }
  ],
  'dm-zoe': [
    { id: 'z0', day: 'Yesterday', time: '7:58p', system: true, text: 'Open door is on for this thread. Pastor Mike Torres and Carla Sandoval receive a copy.' },
    { id: 'z1', day: 'Yesterday', time: '7:59p', from: 'Zoe Gillespie', roleLabel: 'Student · Blue', tint: '#1d4f4a', text: 'Can I bring two friends Wednesday? They have never been.' }
  ]
};

function seedRsvps(): Record<string, Record<string, Rsvp>> {
  const out: Record<string, Record<string, Rsvp>> = { e1: {}, e2: {}, e4: {} };
  ROSTER.forEach((r, i) => {
    const m = i % 6;
    if (m <= 2) out.e1[r.name] = { status: 'going', guests: i % 9 === 0 ? 1 : 0 };
    else if (m === 3) out.e1[r.name] = { status: 'maybe', guests: 0 };
    else if (m === 4) out.e1[r.name] = { status: 'out', guests: 0 };
    if (i % 5 === 0) out.e4[r.name] = { status: 'going', guests: 0 };
  });
  ['Coach Marcus Ramirez', 'Dana Whitfield', 'Carla Sandoval'].forEach((n, i) => {
    out.e2[n] = { status: i === 2 ? 'maybe' : 'going', guests: 0 };
  });
  return out;
}

function attendanceHistory(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const team of ['yellow', 'red', 'blue', 'green']) {
    const roster = ROSTER.filter((r) => r.team === team).length;
    out[team] = Array.from({ length: 9 }, (_, i) =>
      roster ? Math.min(100, 54 + (hashStr(team + ':w' + (i + 1)) % 42) + (roster > 28 ? 3 : 0)) : 0
    );
  }
  return out;
}

export function demoMinistry(now: number = Date.now()): MinistryData {
  return {
    config: {
      ministryName: 'Grace Community Students',
      pointBase: 900,
      weekGrowthPct: 8,
      goalValue: 25,
      versePts: 20,
      verseBoard: 25,
      weekNumber: 9,
      seasonWeeks: 9,
      meetingDates: ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30', '2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28'],
      gameName: 'Pipeline relay',
      venueAddress: 'Grace Community Church · 214 N Church St, main campus gym',
      parentCode: 'SR-9K42',
      inviteCode: 'NSY-W9-4KQ',
      church: {
        address: '214 N Church St, Springfield, MO 65803',
        phone: '(417) 555-0142',
        email: 'students@gracecommunity.org',
        web: 'gracecommunity.org',
        studentsPage: 'gracecommunity.org/students',
        instagram: '@gracestudents',
        youtube: 'youtube.com/@gracecommunity',
        facebook: 'facebook.com/gracecommunity',
        tiktok: ''
      },
      checkinAutoCats: { visitors: true, general: false, bible: false, spiritwear: false, verses: false, games: false, media: false }
    },
    teams: [
      { id: 'yellow', name: 'Yellow', color: '#EAB308', sort: 0, mascotName: 'Blaze the Hornet', mascotStory: 'Blaze showed up in week one on a hand-painted sign and never left. Yellow claims him as proof that the loudest team wins.' },
      { id: 'red', name: 'Red', color: '#DC2626', sort: 1, mascotName: '', mascotStory: '' },
      { id: 'blue', name: 'Blue', color: '#2563EB', sort: 2, mascotName: '', mascotStory: '' },
      { id: 'green', name: 'Green', color: '#16A34A', sort: 3, mascotName: '', mascotStory: '' }
    ],
    cats: [
      { id: 'general', label: 'General', color: '#EA580C', icon: 'ph ph-user-check', hint: 'Attendance, volunteering, sportsmanship' },
      { id: 'spiritwear', label: 'Spiritwear', color: '#DB2777', icon: 'ph ph-t-shirt', hint: 'League shirt, theme dress, best dressed' },
      { id: 'bible', label: 'Bible', color: '#0891B2', icon: 'ph ph-book-bookmark', hint: 'Brought a Bible' },
      { id: 'verses', label: 'Verses', color: '#968ae0', icon: 'ph ph-book-open-text', hint: 'Sunday verse and week verse' },
      { id: 'visitors', label: 'Visitors', color: '#7C3AED', icon: 'ph ph-user-plus', hint: 'Friends brought — the big one' },
      { id: 'games', label: 'Games', color: '#0D9488', icon: 'ph ph-trophy', hint: 'Placement, stopwatch, penalties' },
      { id: 'media', label: 'Media', color: '#65A30D', icon: 'ph ph-video-camera', hint: 'Commercial, chant, mascot story' }
    ],
    roster: ROSTER.map((r) => ({ ...r })),
    ledger: seedLedger(now),
    studentSeedPoints: seedStudentPoints(),
    prayers: [
      { id: 'w1', who: 'Ellison Reid', meta: 'Tue · Yellow', body: 'My little brother starts chemo Monday. Pray he is not scared.', praying: 31, prayed: false, answered: false, at: now - 2 * DAY },
      { id: 'w2', who: 'Anonymous', meta: 'Mon · 11th grade', body: 'Applying to schools and I feel behind everyone. Pray I stop comparing.', praying: 18, prayed: true, answered: false, at: now - 3 * DAY },
      { id: 'w3', who: 'Wyatt Price', meta: 'Last week · Red', body: 'Asked my dad to come to Wednesday night. He said maybe.', praying: 44, prayed: false, answered: true, at: now - 8 * DAY }
    ],
    prayerQueue: [
      { id: 'q1', who: 'Isaac Smith', meta: 'submitted 2h ago · Red', body: 'My grandma has surgery Thursday morning. She raised me. I do not really want it read out loud, just prayed for.', at: now - 120 * MIN },
      { id: 'q2', who: 'Anonymous', meta: 'submitted 40m ago · 9th grade', body: 'Things at home got loud again this week. I am okay at school, it is just after.', at: now - 40 * MIN }
    ],
    careReminders: [
      { id: 'r1', initials: 'WP', name: 'Wyatt Price', meta: 'Missed 3 weeks · Coach Chris flagged Oct 9' },
      { id: 'r2', initials: 'JO', name: 'Janelle Owen', meta: 'Asked to talk after small group · 4 days ago' }
    ],
    events: [
      { id: 'e1', title: 'Week 6 · Capture the Flag', meta: 'Wed 6:45p · Main Gym + field', date: 'Oct 22', color: '#EA580C', roles: ALL_AUDIENCES },
      { id: 'e2', title: 'Coach huddle + assessments', meta: 'Sun 4:00p · Room 204', date: 'Oct 26', color: '#968ae0', roles: ['coaches', 'scorekeeper', 'leaders', 'admins'] },
      { id: 'e3', title: 'Fall Retreat deposit due', meta: 'Deadline · $75 per student', date: 'Oct 31', color: '#EAB308', roles: ALL_AUDIENCES },
      { id: 'e4', title: 'Season finale + trophy night', meta: 'Wed 6:30p · Worship Center', date: 'Nov 19', color: '#0D9488', roles: ALL_AUDIENCES }
    ],
    challenges: [
      { id: 'c1', kind: 'Team', title: 'Invite night: bring three friends', body: 'Blue has 9 of 12 invites logged. Completing it pushes 1,200 Visitors points into the ledger.', pointsLabel: '1,200 pts', status: 'Ready to push', done: true, team: 'blue', cat: 'visitors', amount: 1200 },
      { id: 'c2', kind: 'Individual', title: 'Serve one Sunday in kids ministry', body: '14 students signed up, 9 have served. Coaches confirm from the roster screen.', pointsLabel: '200 pts each', status: '9 / 14 done', done: false },
      { id: 'c3', kind: 'Team', title: 'Memorize Joshua 1:9 as a squad', body: 'Every member recites it once on video. Green is the only team still short.', pointsLabel: '800 pts', status: '3 of 4 squads', done: false }
    ],
    accessRequests: [
      { id: 'req1', name: 'Chris Sandoval', email: 'c.sandoval@gmail.com', personType: 'Leader', household: 'Sandoval household', meta: 'Volunteer since 2019 · background check current', requestedRole: 'coach', flagged: false, note: '', at: now - 42 * MIN, status: 'pending' },
      { id: 'req2', name: 'Renee Boyd', email: 'reneeb@gmail.com', personType: 'Parent', household: 'No household on file', meta: 'Added last week · no linked students', requestedRole: 'parent', flagged: true, note: 'Says she is Trey Boyd’s stepmom.', at: now - 5 * 60 * MIN, status: 'pending' }
    ],
    activityLog: [],
    huddle: seedHuddle(now),
    visitorLog: [
      { id: 'vs1', names: ['Eli Vance'], student: 'Luke Jarvis', team: 'yellow', week: 8, kind: 'new', at: now - 8 * DAY },
      { id: 'vs2', names: ['Cam Brooks'], student: 'Luke Jarvis', team: 'yellow', week: 8, kind: 'new', at: now - 8 * DAY },
      { id: 'vs3', names: ['Shealeigh Frank'], student: 'Melanie Russell', team: 'red', week: 9, kind: 'new', at: now - DAY },
      { id: 'vs4', names: ['Trey Nolan', 'Jaz Nolan'], student: 'Zoe Gillespie', team: 'blue', week: 9, kind: 'known', at: now - DAY }
    ],
    verseLog: [
      { id: 'vl1', student: 'Ellison Reid', team: 'yellow', week: 8, set: 'week', label: 'Ephesians 2:8', count: 1, pts: 150 },
      { id: 'vl2', student: 'Ellison Reid', team: 'yellow', week: 9, set: 'week', label: 'Ephesians 2:10', count: 1, pts: 150 },
      { id: 'vl3', student: 'Luke Jarvis', team: 'yellow', week: 9, set: 'week', label: 'Ephesians 2:10', count: 1, pts: 150 },
      { id: 'vl4', student: 'Zoe Gillespie', team: 'blue', week: 8, set: 'sunday', label: 'Psalm 23', count: 2, pts: 300 },
      { id: 'vl5', student: 'Isaac Lindsey', team: 'blue', week: 9, set: 'week', label: 'Ephesians 2:10', count: 1, pts: 150 }
    ],
    achievements: [],
    studentBadges: STUDENT_BADGES.map((b) => ({ ...b })),
    smallGroups: [
      { id: 'sg1', title: 'Week 9 · Identity in Christ', notes: 'Discussion questions on Ephesians 2:10. Split by grade, 20 min.', weekNumber: 9, screens: [
        { id: 'sgs1', type: 'thought', title: 'Warm-up thought', body: 'What is one thing people assume about you that isn’t true?' },
        { id: 'sgs2', type: 'scripture', title: 'This week’s verse', body: 'For we are God’s handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.', ref: 'Ephesians 2:10' },
        { id: 'sgs3', type: 'game', title: 'Two truths, one lie', body: 'Everyone shares three "facts" about themselves — the group guesses the lie. Go around the circle.' },
        { id: 'sgs4', type: 'pass', title: 'Pass it on', body: 'Pass the phone to the person on your left. They answer: what’s one "good work" you did this week without planning to?' },
        { id: 'sgs4b', type: 'poll', title: 'Quick vote', body: 'Which "good work" sounds most like you this week?', options: ['Helped a teammate', 'Encouraged someone struggling', 'Showed up when it was hard', 'Stayed quiet and prayed'] },
        { id: 'sgs4c', type: 'checklist', title: 'Do it together', body: 'Before you leave the circle, knock these out as a group.', items: ['Everyone shares one prayer request', 'Pick a verse to memorize together', 'Set a time to text-check on each other this week'] }
      ], deepDive: { title: 'Handiwork week — five days in Ephesians', verseRef: 'Ephesians 2:10', verseText: 'For we are God’s handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.', days: [
        { day: 'Mon', ref: 'Ephesians 2:1-5', prompt: 'Read what Paul says we were before grace. Write down one line that stings, and tell God why.' },
        { day: 'Tue', ref: 'Ephesians 2:6-10', prompt: 'Underline every phrase about what God did. Who is doing the work in this passage — you or him?' },
        { day: 'Wed', ref: 'Psalm 139:13-16', prompt: 'Same word, older song. Pray one verse of it back in your own words before you get out of bed.' },
        { day: 'Thu', ref: 'John 15:1-8', prompt: 'Jesus on where good works actually come from. What does “remain in me” look like on a Thursday?' },
        { day: 'Fri', ref: 'Ephesians 2:10', prompt: 'Say the verse without looking. Then text one person the good work you saw God do in them this week.' }
      ], studentAsk: 'Read the day’s passage before school and memorize Ephesians 2:10 by Friday. Bring one thing you noticed to small group.', leaderPrep: 'Know the flow of Ephesians 2: dead, but — grace — handiwork. The order matters, or the challenge becomes performance. Expect “so do my good works count if I only did them because I was told to?” — answer from v.8-9 before v.10. Do the five days yourself; students can tell when you have not.' } },
      { id: 'sg2', title: 'Week 8 · Handling pressure', notes: 'Video clip + prayer pairs. Captains lead their own team.', weekNumber: 8, screens: [
        { id: 'sgs5', type: 'scripture', title: 'Opening verse', body: 'Cast all your anxiety on him because he cares for you.', ref: '1 Peter 5:7' },
        { id: 'sgs5b', type: 'video', title: 'Testimony clip', body: 'Play this, then open it up.', videoUrl: '' },
        { id: 'sgs6', type: 'thought', title: 'Discussion', body: 'What’s something that’s been stressing you out lately — school, home, friends?' }
      ] }
    ],
    deepSubs: [
      { id: 'dsub1', groupId: 'sg1', dayIdx: 0, day: 'Mon', ref: 'Ephesians 2:1-5', prompt: 'Read what Paul says we were before grace. Write down one line that stings, and tell God why.', student: 'Isaac Smith', team: 'red', text: 'The line that got me was “dead in our transgressions.” I always thought I was just kind of messing up sometimes, not dead. It makes the next part hit different because I did not fix it, God did. I told him I have been trying to earn something he already gave me.', at: now - 90 * MIN, status: 'pending', points: 150 },
      { id: 'dsub2', groupId: 'sg1', dayIdx: 1, day: 'Tue', ref: 'Ephesians 2:6-10', prompt: 'Underline every phrase about what God did. Who is doing the work in this passage — you or him?', student: 'Maya Chen', team: 'blue', text: 'Every single phrase was God. Made us alive, raised us up, seated us. The only thing I do is walk in the good works he already prepared. That is kind of a relief honestly.', at: now - 200 * MIN, status: 'pending', points: 150 }
    ],
    awards: [
      { id: 'aw1', name: 'Top Squad', description: 'Highest total points this season — awarded automatically.', decidedBy: 'score', categoryId: null },
      { id: 'aw2', name: 'Bible Champions', description: 'Most memory-verse points earned — awarded automatically.', decidedBy: 'score', categoryId: 'verses' },
      { id: 'aw3', name: 'Most Spirited', description: 'Which team brings it every week? Everyone gets a vote.', decidedBy: 'vote', recipientType: 'team', votingOpen: true, voteFrequency: 'weekly', nominees: [] },
      { id: 'aw4', name: 'MVP', description: 'The student who went above and beyond this season.', decidedBy: 'vote', recipientType: 'individual', votingOpen: true, voteFrequency: 'once', nominees: [{ id: 'n1', name: 'Ellison Reid' }, { id: 'n2', name: 'Melanie Russell' }, { id: 'n3', name: 'Wyatt Price' }] },
      { id: 'aw5', name: 'Most Devoted', description: 'Longest Bible memory-verse streak this season — awarded automatically.', decidedBy: 'streak', metric: 'bible' },
      { id: 'aw6', name: 'Never Miss', description: 'Longest attendance streak this season — awarded automatically.', decidedBy: 'streak', metric: 'attendance' }
    ],
    awardVotes: {},
    media: [
      ...['Dodgeball final', 'Sideline crowd', 'Blue huddle', 'Yellow win', 'Bracket board', 'Worship set'].map((label, i) => ({ id: 'm9-' + i, week: 9, kind: 'photo' as const, label, url: null, at: now - i * MIN })),
      { id: 'm4-0', week: 4, kind: 'video' as const, label: 'Red commercial', url: null, at: now - 35 * DAY },
      { id: 'm4-1', week: 4, kind: 'photo' as const, label: 'Mascot art', url: null, at: now - 35 * DAY },
      { id: 'm4-2', week: 4, kind: 'audio' as const, label: 'Green chant', url: null, at: now - 35 * DAY },
      { id: 'm3-0', week: 3, kind: 'video' as const, label: 'Recitations (11)', url: null, at: now - 42 * DAY },
      { id: 'm3-1', week: 3, kind: 'photo' as const, label: 'Small groups', url: null, at: now - 42 * DAY },
      { id: 'm3-2', week: 3, kind: 'photo' as const, label: 'Altar call', url: null, at: now - 42 * DAY }
    ],
    clips: [],
    chatThreads: CHAT_THREADS,
    chatMsgs: CHAT_SEED,
    chatUnread: { all: 2, leaders: 1, 'team-blue': 3, parents: 0, 'dm-mike': 0, 'dm-zoe': 1 },
    rsvps: seedRsvps(),
    attendanceHistory: attendanceHistory(),
    bible: { streak: 12, xp: 340, due: 3, loggedToday: false },
    tonight: { date: '2026-10-28', presence: {}, checkinDetail: {}, checkinPosted: {}, goals: {}, pushed: {}, heatPosted: null },
    bracket: { enabled: false, seeds: [], winners: {}, liveSeed: true, paid: {} },
    challengeCredit: {}
  };
}

/** Who each demo persona is signed in as. */
export const DEMO_PEOPLE: Record<string, { displayName: string; firstName: string; initials: string; teamId: string | null; studentName: string | null }> = {
  leader: { displayName: 'Pastor Mike', firstName: 'Pastor Mike', initials: 'MT', teamId: null, studentName: null },
  owner: { displayName: 'Renee Boyd', firstName: 'Renee', initials: 'RB', teamId: null, studentName: null },
  scorekeeper: { displayName: 'Sam Okafor', firstName: 'Sam', initials: 'SO', teamId: null, studentName: null },
  coach: { displayName: 'Coach Chris', firstName: 'Coach Chris', initials: 'CS', teamId: 'yellow', studentName: null },
  captain: { displayName: 'Ellison Reid', firstName: 'Ellison', initials: 'ER', teamId: 'yellow', studentName: 'Ellison Reid' },
  member: { displayName: 'Ellison Reid', firstName: 'Ellison', initials: 'ER', teamId: 'yellow', studentName: 'Ellison Reid' },
  parent: { displayName: 'Dana Reid', firstName: 'Dana', initials: 'DR', teamId: 'yellow', studentName: 'Ellison Reid' },
  congregation: { displayName: 'Guest', firstName: 'Friend', initials: 'GC', teamId: null, studentName: null }
};
