/* The library: units a ministry can lift into its own season — a week, a
   lesson, a game, a guide, a series, an event, a whole season. A unit
   carries content and suggested point values, never anything about a
   student; that is a constraint on the table, not a filter on the screen. */
import type { LibraryUnit } from '@/lib/types/model';

export const LIB_KINDS = [
  { id: 'week', label: 'Weeks', icon: 'ph ph-calendar-check', one: 'Week' },
  { id: 'lesson', label: 'Lessons', icon: 'ph ph-book-open-text', one: 'Lesson' },
  { id: 'game', label: 'Games', icon: 'ph ph-confetti', one: 'Game' },
  { id: 'guide', label: 'Small groups', icon: 'ph ph-users-three', one: 'Guide' },
  { id: 'series', label: 'Series', icon: 'ph ph-stack', one: 'Series' },
  { id: 'event', label: 'Events', icon: 'ph ph-tent', one: 'Event' },
  { id: 'season', label: 'Seasons', icon: 'ph ph-map-trifold', one: 'Season' }
] as const;
export const kindOf = (id: string) => LIB_KINDS.find((k) => k.id === id) ?? LIB_KINDS[0];

/** Demo library: this ministry's own units plus a few shared by other
 *  (fictional) ministries, as the design shows it. */
export const DEMO_LIBRARY: LibraryUnit[] = [
  { id: 'lu1', kind: 'week', title: 'Lost & Found', church: null, span: '1 week', theme: 'Belonging', summary: 'The lost sheep, a hide-and-seek game that pays the finders, and a guide that lands on who is missing from your own squad.', includes: ['Lesson · 22 min', 'Game · Sheep Hunt', 'Small group guide', 'Verse · Luke 15:4'], pts: [['general', 100], ['games', 250], ['verses', 150]], used: 'Ran week 3 last season' },
  { id: 'lu2', kind: 'week', title: 'Invite Night', church: 'Grace Chapel · Tulsa', span: '1 week', theme: 'Outreach', summary: 'Built around bringing a friend. Doubled visitor points, a game that only works with odd numbers, and a send-home card.', includes: ['Lesson · 18 min', 'Game · Human Bingo', 'Small group guide', 'Parent card'], pts: [['visitors', 600], ['general', 120], ['games', 200]], used: 'Downloaded 214 times' },
  { id: 'lu3', kind: 'lesson', title: 'The Prodigal, told twice', church: null, span: '25 min', theme: 'Grace', summary: 'Once from the younger son, once from the older. Two handouts, one question that does the work.', includes: ['Teaching outline', 'Two handouts', 'Six discussion questions'], pts: [], used: 'Written by Pastor Mike' },
  { id: 'lu4', kind: 'lesson', title: 'Why we serve', church: 'Northview Students', span: '20 min', theme: 'Service', summary: 'Short teaching that sets up a serving week. Pairs with the community-service point rows.', includes: ['Teaching outline', 'Serving sign-up sheet'], pts: [['general', 400]], used: 'Downloaded 88 times' },
  { id: 'lu5', kind: 'game', title: 'Pipeline Relay', church: null, span: '15 min', theme: 'Teamwork', summary: 'Squads move water down a line of half-pipes without touching it. Works in a gym or a parking lot.', includes: ['Rules card', 'Field map', 'Gear list · 8 items'], pts: [['games', 250]], used: 'Running week 9' },
  { id: 'lu6', kind: 'game', title: 'Blackout Dodgeball', church: 'Ridge Youth · Bend', span: '20 min', theme: 'Energy', summary: 'Lights off, glow balls, two-minute rounds. The rules card names the three ways someone gets hurt and how to stop it.', includes: ['Rules card', 'Safety notes', 'Gear list · 5 items'], pts: [['games', 300]], used: 'Downloaded 340 times' },
  { id: 'lu7', kind: 'guide', title: 'Who do you text at 2am?', church: null, span: '8 screens', theme: 'Belonging', summary: 'A guide about who you actually go to. Ends in a would-you-rather nobody answers fast.', includes: ['8 screens', 'Leader notes', 'One prayer prompt'], pts: [['bible', 150]], used: 'Used by 4 squads' },
  { id: 'lu8', kind: 'guide', title: 'The verse you skipped', church: 'Grace Chapel · Tulsa', span: '6 screens', theme: 'Scripture', summary: 'Works the hard half of a familiar verse. Built for squads that memorize fast and think slow.', includes: ['6 screens', 'Scripture screens ×3', 'Timer screen'], pts: [['verses', 200]], used: 'Downloaded 51 times' },
  { id: 'lu9', kind: 'series', title: 'Named — a four-week series', church: null, span: '4 weeks', theme: 'Identity', summary: 'Four weeks on what God calls you versus what the room calls you. Carries its own game arc and a closing night.', includes: ['4 weeks', '4 lessons', '4 guides', 'Closing night plan'], pts: [['general', 100], ['bible', 200]], used: 'Ran last spring' },
  { id: 'lu10', kind: 'series', title: 'Five Fridays of Service', church: 'Northview Students', span: '5 weeks', theme: 'Service', summary: 'Five off-campus serving nights with the logistics already written — transport, waivers, and what the squads earn.', includes: ['5 weeks', 'Site list', 'Waiver template', 'Transport plan'], pts: [['general', 500]], used: 'Downloaded 127 times' },
  { id: 'lu11', kind: 'event', title: 'Fall Camp · 3 nights', church: null, span: '3 days', theme: 'Camp', summary: 'Cabin sheets, a payment tracker, and a run sheet per night. The payment door is tracking only.', includes: ['Run sheet ×3', 'Cabin sheet', 'Payment tracker', 'Packing list'], pts: [['general', 900]], used: 'Oct 10–12 last year' },
  { id: 'lu12', kind: 'event', title: 'Parent Night', church: 'Ridge Youth · Bend', span: '1 evening', theme: 'Families', summary: 'The night you show parents the board. Slides, a script, and the read-only link on a card.', includes: ['Slide outline', 'Script', 'Board link card'], pts: [], used: 'Downloaded 63 times' },
  { id: 'lu13', kind: 'season', title: 'Fall 2025 · nine weeks', church: null, span: '9 weeks', theme: 'Full season', summary: 'Last fall, whole. Copy it forward and the dates re-lay onto this year’s Wednesdays; the answers come with it.', includes: ['9 weeks', 'Draft night', 'Award races ×4', 'Scoring rules'], pts: [['general', 100], ['games', 250], ['verses', 150], ['visitors', 500]], used: 'Champion: Yellow' },
  { id: 'lu14', kind: 'season', title: 'Summer short season · 6 weeks', church: 'Grace Chapel · Tulsa', span: '6 weeks', theme: 'Summer', summary: 'Six weeks built for a thin summer roster — fewer squads, outdoor games, no memory board.', includes: ['6 weeks', 'Outdoor game set', 'Scoring rules'], pts: [['general', 150], ['games', 300]], used: 'Downloaded 39 times' }
];
