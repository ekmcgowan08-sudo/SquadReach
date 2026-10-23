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
| `/console` (as a leader) | The desktop console: setup, squads, scoring, people, the huddle sheet, reports |
| `/b/SR-9K42` | The public parent board, with no sign-in (More → Parent Board Link shows and rotates it) |

To reset the demo, clear the site’s storage for localhost.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (scoring, feeds, outbox, game clock, CSV) |
| `npm run db:test` | Applies the migration to a throwaway Postgres and runs the RLS tests. Needs Postgres 15+ binaries on `PATH` or under `/usr/lib/postgresql/*/bin` |

## Running against Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
3. Apply the schema. With the Supabase CLI linked to your project, run
   `supabase db push`. You can also paste
   `supabase/migrations/20261023000000_squadrise.sql` into the SQL editor.
   The migration:
   - creates every table, with RLS on each one;
   - creates the RPCs (`create_ministry`, `request_access`, `decide_access`,
     `public_board`, `rotate_invite_code`, `rsvp_counts`, and others);
   - adds `score_entries`, `nights`, `chat_messages` and `rsvps` to the
     `supabase_realtime` publication;
   - creates the private `media` storage bucket and its policies.
4. In **Authentication → URL Configuration**:
   - set the Site URL to your deployed origin;
   - add `<origin>/auth/callback` to the redirect URLs.

   Sign-in uses email magic links.
5. Run `npm run dev` (or deploy) and sign in. A first-time user can either:
   - create a ministry and become its owner; or
   - ask to join one with an invite code or a `/join/<code>` link. A leader
     approves the request under **Access requests**.

Set both variables or neither. With only one set, the app stays in demo mode.

## How it’s put together

```
app/                 Routes (App Router). /dashboard/* is the phone app,
                     /console the desktop console, /projector the room screen,
                     /b/<code> the public board, /login /welcome /join auth.
components/screens/  One file per area (night, games, bible, calendar, chat…)
components/shell/    Phone shell, tab bar, sheets, the walkthrough
lib/types/domain.ts  Roles and the role lists every gate reads
lib/permissions.ts   Every gate as a named question (canScore, canApprove…)
lib/scoring.ts       Standings, category totals, student ranks — all derived
lib/feeds.ts         Automatic points (attendance, Bible practice, challenges)
lib/game.ts          Game clock, heats, penalties, placement awards
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
  connection says so and isn’t faked. The service worker is network-first
  and caches no pages: a stale score during a live event is worse than no
  offline support.
- **Per-device preferences** (theme, reduced motion, home sections,
  notification triggers) live in `localStorage` and apply before first
  paint.

## Not built yet / open decisions

These came up while building from the prototype and need a product call:

- **Parents and congregation members** are demo personas only. The database
  has roles from `member` to `owner`. Parents get the public board
  (`/b/<code>`) instead of an account.
- **Direct messages** work in demo mode only. In Supabase mode, chat is the
  squad and staff threads.
- **Game film clips** stay on the device that recorded them (IndexedDB).
  Photos upload to the `media` bucket. Clips would need a size and retention
  policy before they upload too.
- **Library sharing** goes out to other ministries with no review step.
- **Who can grant owner.** The `members_manage` policy lets any leader add,
  change or remove memberships, including making someone an owner. The join
  flow can’t request owner, but if only owners should grant it, the policy
  needs to be tightened.
- **Prototype screens not built**: the year-planning boards (seven-year plan,
  ministry year board), prep week, the post-night recap flow, serving
  rotations and parent messaging.
