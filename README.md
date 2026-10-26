# SquadRise

Run a student ministry’s season like a league. Squads, live points, check-in,
the volunteer huddle, prayer and follow-up, Bible memory, events, chat and a
projector board, all from one phone.

This is a Next.js app built from the SquadRise design handoff (Nocturne
theme). It runs in two modes:

- **Demo mode** needs no setup. It boots on the seeded “Grace Community
  Students” ministry and keeps everything on this device. The avatar menu
  lets you switch roles, so you can see every screen as a student, captain,
  coach, scorekeeper, leader, owner, parent or congregation member.
- **Supabase mode** turns on when both Supabase environment variables are set.
  You get real sign-in, a real ministry, row-level security and live updates
  across phones.

## Quick start (demo)

```bash
npm install
npm run dev
```

Open http://localhost:3000. On a desktop browser, use the device toolbar at
phone width (the app is laid out for a 390–430px column).

Things worth trying first:

| Where | What it shows |
| --- | --- |
| `/dashboard` | Home: tonight’s card, standings, races, notices |
| Centre **Score** tab | The score pad. Coaches’ entries wait for approval; scorekeepers’ post at once |
| More → **Walkthrough** (as a leader) | A guided tour of a week, in nine chapters |
| `/dashboard/games` → `/projector` | Start a heat on the phone and watch it on the room screen |
| More → **Prep week**, **Night recap**, **Serving & swaps**, **Message parents**, **Door kiosk** | The week around the night. In demo mode, the “Preview as of” chips move the clock through the week |
| `/f/demo-reid-family` | A parent’s private family link: tonight’s card, permission slips to sign, messages. No account |
| `/console` (as a leader) | The desktop console: setup, the season interview, squads, scoring, people (with a who-can-do-what table read off the real permission checks), the huddle sheet, reports and their delivery schedule, the walkthrough |
| `/planner` (as a leader) | The desk planner: tonight, prep and recap, people, the seven-year roadmap, the ministry year, season and night, coverage, the liturgical year, settings. ⌘K jumps anywhere |
| `/planner/setup` | The plan’s guided setup: the seven-year range, groups, the night you meet and its breaks, church identity, lanes and goals |
| `/planner/live?tab=run` → **Open the room screen** | Live ministry time. Open an activity and a pretend room answers; the room screen in the other window follows |
| More → **Live** | The same, on the phone: the leader’s console, or the answer pad for everyone else |
| `/b/SR-9K42` | The public parent board, with no sign-in (More → Parent Board Link shows and rotates it) |

To reset the demo, clear the site’s storage for localhost.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (scoring, feeds, outbox, game clock, the night cycle, seasons, reports, plan dates and insights, live ministry time) |
| `npm run e2e` | Playwright tests in demo mode (`e2e/`): smoke tests on a phone and at a desk, and axe accessibility scans of about sixty screens (any serious or critical WCAG 2.1 AA finding fails), and the handoff's Pilot QA: every desk screen at 1180, 1280 and 1440px with no sideways scroll, nothing past the window edge, no control wrapped onto two lines, and the nav faded exactly when links are cut off; and the handoff's tap-target walk: every button and link on about forty phone screens and overlays (the recorder, the small-group player, the role sheet, library sheets) at least 44px tall, the memory drill's verse words excepted at 24px. Starts the app itself; set `E2E_BASE_URL` to test a running one |
| `npm run db:test` | Applies every migration to a throwaway Postgres and runs the RLS tests in `supabase/tests/*.test.sql`. Needs Postgres 15+ binaries on `PATH` or under `/usr/lib/postgresql/*/bin` |

## Running against Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
3. Apply the schema. With the Supabase CLI linked to your project, run
   `supabase db push`. You can also paste each file in
   `supabase/migrations/` into the SQL editor, in order:

   | Migration | What it adds |
   | --- | --- |
   | `20261023000000_squadrise.sql` | Every core table with RLS; the RPCs (`create_ministry`, `request_access`, `decide_access`, `public_board`, `rotate_invite_code`, `rsvp_counts` and others); realtime on `score_entries`, `nights`, `chat_messages`, `rsvps`; the private `media` bucket |
   | `20261023120000_night_cycle.sql` | The week around the night: reminders, follow-ups, notes, pickup, door flags, serving schedule, availability, swaps, volunteer invites, families and their private links, permission slips, parent messages; `self_check_in`, `family_view`, `family_sign`, `family_read` |
   | `20261023130000_roles_and_messages.sql` | Only an owner makes an owner; direct messages and the chat directory |
   | `20261023140000_live_ministry_time.sql` | `live_rooms` and `live_answers` for live ministry time (both on realtime); the plan and season-interview documents become leader-only |
   | `20261025090000_doc_revisions.sql` | A revision on every ministry document, `save_doc` (writes only over the revision you saw), and realtime on `ministry_docs` |
   | `20261025100000_report_email.sql` | `report_sends` (each delivery's period claimed once) and `delivery_emails`, which only the server may call |
   | `20261025110000_library_names.sql` | Shared library units can't name a student, guardian or account holder |
   | `20261025120000_live_cast.sql` | Cast links: the room screen on a TV or cast device, for one evening, with no sign-in |
   | `20261025130000_library_reports.sql` | Reports on shared library units: hidden from a ministry that reports one, and from everyone once two do |
   | `20261026100000_planning_center.sql` | `pco_connections` (a ministry's Planning Center tokens, server-only) and `pco_status`; attendance can record a Planning Center check-in |

4. In **Authentication → URL Configuration**:
   - set the Site URL to your deployed origin;
   - add `<origin>/auth/callback` to the redirect URLs.

   Sign-in uses email magic links.
5. Run `npm run dev` (or deploy) and sign in. A first-time user can either:
   - create a ministry and become its owner; or
   - ask to join one with an invite code or a `/join/<code>` link. A leader
     approves the request under **Access requests**.

Set both variables or neither. With only one set, the app stays in demo mode.

### Ideas from Claude (optional)

Set `ANTHROPIC_API_KEY` on the server. Leaders then get “Ask Claude for
ideas” on Planner › Roadmap › Suggestions (`/api/planner/suggest`, one ask per
leader every 30 seconds). The demo is off unless `PLANNER_AI_IN_DEMO=1`.

### Report emails (optional)

The console's delivery schedule always lands in people's notifications. To
email it as well:

1. Set `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` and
   `CRON_SECRET` on the server (see `.env.example`).
2. Call `GET /api/cron/deliveries` every 15 minutes or so with
   `Authorization: Bearer $CRON_SECRET`. On Vercel, `vercel.json` already
   schedules it (sub-daily cron jobs need a paid Vercel plan; elsewhere, any
   scheduler that can make an HTTP request will do).
3. Set the ministry's time zone in Console › Setup. Deliveries go out by that
   clock.

The same secret runs `GET /api/cron/media` once a day (also in `vercel.json`),
which removes game film past the ministry's keep-for days.

Each (delivery, period) is claimed in `report_sends` before anything is sent,
so the job running twice never sends twice, and a period more than a day
overdue is skipped rather than sent late. Recipients are matched to the
email on their account by name. The console shows who had no email on file.
“Send now” emails through the same path.

### Planning Center (optional)

Register an OAuth application with Planning Center
(api.planningcenteronline.com/oauth/applications), with the redirect URI
`<your origin>/api/pco/callback`, and set `PCO_CLIENT_ID` and
`PCO_CLIENT_SECRET` (plus `SUPABASE_SERVICE_ROLE_KEY`). Then a leader connects
the ministry's own Planning Center from Console › People and can:

- import students into the roster — everyone in the grades the plan serves,
  or one Planning Center list — after a preview of exactly who comes in;
  names already on the roster are skipped and new students arrive without a
  squad;
- pull the night's Planning Center check-ins from Night recap › Attendance
  (coaches can too), which marks matching roster names here and lists the
  check-ins that match nobody.

SquadRise asks only for the `people` and `check_ins` scopes and only reads.
The tokens sit in `pco_connections`, which no client can read; they refresh
themselves, and Disconnect forgets them.

### Plans & Billing, for the vendor (optional)

Pricing is vendor-only. `/vendor` is a calculator over the four candidate
models in `lib/pricing.ts` (flat annual by size band, recommended; per
student; per season; per leader seat), the reasoning for the recommendation,
and what each band includes. Set `VENDOR_EMAILS` to the sign-in emails that
may open it; anyone else, every ministry owner included, gets a 404. With
`SUPABASE_SERVICE_ROLE_KEY` set it also lists every ministry — rostered
students, leaders with a login, seasons saved this year — priced under each
model, with the yearly total. A demo build opens it only with `VENDOR_DEMO=1`.

## How it’s put together

```
app/                 Routes (App Router). /dashboard/* is the phone app,
                     /console the desktop console, /planner the desk planner,
                     /projector and /live/room the room screens, /b/<code> the
                     public board, /f/<token> a family's private link,
                     /login /welcome /join auth.
components/screens/  One file per phone area (night, games, bible, calendar, chat…)
components/console/  The console's tabs
components/planner/  The planner's screens and its shell (nav, ⌘K, undo/redo)
components/live/     Live ministry time: console, room screen, student pad, setup
components/shell/    Phone shell, tab bar, the walkthrough
lib/types/domain.ts  Roles and the role lists every gate reads
lib/permissions.ts   Every gate as a named question (canScore, canApprove…)
lib/scoring.ts       Standings, category totals, student ranks — all derived
lib/feeds.ts         Automatic points (attendance, Bible practice, challenges)
lib/game.ts          Game clock, heats, penalties, placement awards
lib/cycle.ts         The week around the night: times, reminders, follow-ups, serving, families
lib/plan.ts          The seven-year plan: years, seasons, nights, teaching, service order
lib/plan-insights.ts Coverage, checks, suggestions and the publish diff — derived, never stored
lib/plan-ai.ts       What Claude is told about the plan, and the checks every idea passes
lib/merge3.ts        Three-way merge for documents leaders edit together (lib/data/doc-sync.ts saves them)
lib/liturgical.ts    Easter (Meeus), Advent and the church year
lib/live.ts          Live ministry time: tallies, scoring, what the room may see
lib/report-builder.ts Reports from an allow-list of fields, and their delivery schedule
lib/server/          Server-only: the scheduled report emails (app/api/cron/deliveries)
lib/store/           Zustand store: award(), the offline outbox, actions
lib/data/            Backend interface, with demo (localStorage) and Supabase versions
supabase/            Migration and RLS tests
public/              Manifest, icons, service worker, offline page
```

Rules the code holds to:

- **Points enter through one door.** Every award goes through `award()` /
  `awardMany()` in `lib/store/app-store.ts` as a ledger entry. Totals are
  always computed from the ledger and never stored. Reversals are new
  entries that point at the one they undo.
- **The same gate on both sides.** The menu row that shows a screen and the
  screen’s own server-side `requireGate` call the same function in
  `lib/permissions.ts`. The database’s RLS policies use the same role lists
  as `lib/types/domain.ts`, and `supabase/tests/rls.test.sql` tests them
  role by role.
- **Offline is honest.** Points and approval decisions made without signal
  wait in the outbox and send once, by id, when you’re back online. Chat
  messages and RSVPs are held the same way. Anything else that needs a
  connection says so and isn’t faked. Ministry documents (the plan,
  reports, small groups) edited without signal stay on the phone and save
  themselves — merged with anyone else’s — when you’re back; a save that
  fails with signal is tried again after 15 seconds. The planner says “Not
  saved yet” until it lands. The service worker is network-first
  and caches no pages: a stale score during a live event is worse than no
  offline support.
- **Derived, not stored.** Standings, coverage, plan checks, suggestions and
  what a publish would change are all computed when read. Three statuses
  only — healthy, attention needed, gap — each with its reason, and no
  composite score anywhere.
- **Suggest, never act.** Plan suggestions — rule-based, or from Claude on
  request — are drafts with their reason and passage references. Adding one makes a dashed draft; confirming
  it, publishing, and messaging always take a leader’s tap.
- **Per-device preferences** (theme, reduced motion, home sections,
  notification triggers, one-pager paper) live in `localStorage` and apply
  before first paint.

## Decisions made along the way

Where the prototype left a call open, the build took the safer default:

- **Only an owner makes an owner.** Leaders manage everyone else
  (`members_manage_owner`, `members_manage_leader`).
- **Direct messages.** Adults can message each other privately. Any thread
  with a student in it is an open door: leaders can read it but not post in
  it. Students can’t message each other.
- **Library placements are copies.** Placing a shared unit copies it into
  your ministry with credit to where it came from, so the original can
  change or disappear without breaking your season.
- **Parents get a private link, not an account.** `/f/<token>` shows one
  student’s card, the slips to sign and messages to read, through
  security-definer RPCs that check the token. Rotating it ends the old link.
- **Reports come from an allow-list.** The builder can only reach the fields
  in `REPORT_SOURCES`. A delivery works out its recipients when it sends, so
  a trade or a new captain never leaves a stale mailing list. A send is
  idempotent on (delivery, period).
- **The plan is the leaders’ document.** It holds debrief notes and trivia
  answers, so only leaders read it (the season interview too). Everyone
  else sees what the app publishes from it.
- **Ideas from Claude go through the same gate as every suggestion.** With
  `ANTHROPIC_API_KEY` set, Suggestions has an “Ask Claude for ideas” button.
  The server reads the plan as the signed-in leader (no student names),
  asks for series that fill its gaps in the church's tradition and
  translation, and checks every answer before showing it: passages must be
  real references, no quotations, known coverage tags only, no repeats of
  the plan. Anything that fails is dropped, not repaired. An idea becomes a
  dashed draft only when a leader taps it. If the model declines, a
  fallback model is tried server-side; if that declines too, the leader is
  told so.
- **Back goes back.** On the phone, Back returns to whatever opened the
  screen (an event opened from the calendar returns to the calendar); only
  a screen loaded cold falls back to its parent. More keeps a Recent row of
  the deep screens you opened lately once there are two — on this device,
  across reloads, for the role you're in; switching role or signing out
  clears it, and anything the role can't open drops out.
- **Plan items move three ways.** Drag with a mouse; on a touch screen,
  hold a chip for about 0.4s, slide it and lift (a finger that moves sooner
  is a scroll); or focus it and press Alt + arrows. Every move is one undo
  step (⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y).
- **Leaders edit together without overwriting each other.** The plan,
  reports and other ministry documents carry a revision. A save only lands
  over the revision the phone last saw; otherwise it merges onto what's
  there (`lib/merge3.ts`: each side's changes kept, removals honoured unless
  the other side edited the thing, mine wins only when both changed the same
  value) and goes again. Other leaders' saves arrive over realtime and merge
  into unsaved local edits. Undo reverts only its own step.
- **A shared library unit can't name anyone.** Other ministries read the
  library, so sharing shows exactly what will go, and a unit naming a
  student, a guardian or anyone with an account in the ministry is refused —
  on the phone (`lib/library-share.ts`) and by the database
  (`library_units_names`), whichever comes first. Single words aren't
  checked; too many names are also ordinary words.
- **The ministries reading the library are its review.** Nobody checks a
  unit before others can read it. Instead a leader can report another
  ministry's unit (it names a person, isn't right for students, has
  something wrong in it, or something else, with an optional note). It
  leaves that ministry's library at once; once two ministries have reported
  it, it leaves every library but the sharer's. The sharing ministry's
  leaders see each reason and note — never who sent it — and can stop
  sharing the unit; a unit that changes starts over with no reports.
- **Game film is off the server by default.** A clip stays on the phone
  that filmed it. A leader can allow clips in the week album (Console ›
  Setup › Game film), with a size limit per clip (80 MB unless changed) and
  a keep-for period (60 days unless changed). `GET /api/cron/media` runs
  daily and removes expired film, file first and then its album row; photos
  are never touched. Supabase's own upload limit (50 MB on the free plan)
  still applies.
- **Live ministry time.** Answers can only be written while an activity is
  open (with three seconds’ grace after its timer). The database stamps
  each answer’s time and the first name shown, so speed and names can’t be
  faked. The right answer stays off every phone until the reveal, and
  cloud words wait for a leader. Points rank the room for the night; they
  don’t post to the squad board.
- **The room screen goes where the room is.** On a computer with a second
  display, the room window opens on it. A TV or cast device can't sign in,
  so **Cast to a TV** makes a cast link (`/c/…`) that reads only the room
  snapshot — what the room is shown anyway, never answers — for twelve
  hours or until a leader stops it. Chrome offers its cast picker for it;
  any other screen can open the link in its browser.
- **Pricing is vendor-only, and not decided.** No ministry sees a price or
  the calculator; it lives on the founder's `/vendor` admin. The handoff
  recommends the flat annual band (a youth budget is set once a year, and
  per-student pricing charges for the growth the app exists to cause), but
  the numbers are there to test on real churches. Nothing is billed.

## Not built yet / open decisions

- **Congregation members** are a demo persona only. Parents have the family
  link and the public board.
- **Casting from the demo.** The demo's room lives on one device, so it
  has no cast link; open the room screen in another window instead.
