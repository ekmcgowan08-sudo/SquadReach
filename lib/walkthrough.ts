/* The walkthrough: chapters in the order a week actually happens, each with
   a why, a few steps and somewhere real to go — reading it and doing it are
   one trip. Under it, a setup checklist computed from the ministry's real
   state, so it can never claim something is set up when it isn't. Adding a
   chapter is one entry. */
import type { MinistryData } from '@/lib/types/model';

export interface Chapter {
  id: string;
  title: string;
  mins: number;
  why: string;
  steps: string[];
  href: string;
  go: string;
}

export const CHAPTERS: Chapter[] = [
  { id: 'w0', title: 'Answer the questions and let it build the season', mins: 6, href: '/console?tab=season', go: 'Open the season builder',
    why: 'Faster than setting seventeen things by hand, and you see the whole season before you approve it.',
    steps: ['Seventeen questions about how you actually run your ministry — how many weeks, whether points carry, who can score.', 'Skip anything and the common answer fills in, marked as a default. Nothing is locked.', 'The last screen is the whole season in one place. Change what is wrong, then make it live.'] },
  { id: 'w1', title: 'Set what things are worth', mins: 4, href: '/console?tab=scoring', go: 'Open scoring',
    why: 'Everything else in the app multiplies these numbers, so start here.',
    steps: ['Set the point base for the week — later weeks are worth more, so a slow start can’t decide the season.', 'Set the verse board: what one verse pays and how many are posted.', 'Name your point categories. Anything you can’t put in a category won’t show up in a report.'] },
  { id: 'w1b', title: 'Write the run of show', mins: 4, href: '/console?tab=huddle', go: 'Open the huddle sheet',
    why: 'The sheet everyone serving opens before the doors. If it is wrong, the night is wrong.',
    steps: ['Start from a template, then reorder, reword and retime until it is yours.', 'Assign the items that only happen if one person remembers them. Whole-team moments can stay unowned.', 'Publish. Everyone you assigned is told, and the huddle screen picks it up.'] },
  { id: 'w1c', title: 'Get the week ready', mins: 3, href: '/dashboard/prep-week', go: 'Open prep week',
    why: 'Reminders go out on their own; this is where you see them and what still has to be true by the night.',
    steps: ['Four reminders post before the night — send one early, switch one off, or change its words for this week.', 'Fill open spots and approve swaps from Serving.', 'Chase unsigned permission slips from Message parents.'] },
  { id: 'w2', title: 'Take check-in on the floor', mins: 5, href: '/dashboard/coach-view', go: 'Show me on the phone',
    why: 'One sheet per student, filled in while you are standing in front of them.',
    steps: ['Tap a squad, then a student, then everything true about tonight.', 'Rows that open — friends, articles, verses, volunteering — hold a count or a photo. The maths happens beside the row.', 'Post it once. The points, the visitor names and the achievements all come from that one tap.'] },
  { id: 'w3', title: 'Run the game and film it', mins: 4, href: '/dashboard/media', go: 'Show me on the phone',
    why: 'The person holding the phone can also be the person scoring.',
    steps: ['Open Media & Film, pick who is playing, and start recording.', 'Tap the squad that scored. Points land in the ledger and on the overlay at the same time.', 'A mis-tap is one Undo away. Nothing you tap is hidden from the audit trail.'] },
  { id: 'w4', title: 'Approve what leaders sent in', mins: 3, href: '/dashboard/approvals', go: 'Show me on the phone',
    why: 'Points submitted by coaches and captains wait for you, with proof attached.',
    steps: ['The queue sits on your Home screen. Each row says who submitted it and why.', 'Photo proof is optional everywhere — it pays a bonus rather than being a gate.', 'Approve or send back. Either way it is written to the audit log with your name on it.'] },
  { id: 'w5', title: 'Follow up after the night', mins: 3, href: '/dashboard/night-recap', go: 'Open the recap',
    why: 'A visitor you can’t name is a visitor you won’t call.',
    steps: ['When the night wraps, the recap builds the follow-ups: first-time visitors, regulars who were missing, prayer, thank-yous.', 'Each one belongs to one person and is due within 48 hours.', 'Draft the message right there, text it, and mark it done.'] },
  { id: 'w6', title: 'Send the week out', mins: 4, href: '/console?tab=reports', go: 'Open reports',
    why: 'Coaches and captains shouldn’t have to ask you for their roster.',
    steps: ['Anything you need that isn’t already a report, build — pick what it reads, the columns, what to leave out.', 'Each delivery is a report, an audience, a day and a time.', '“Their squad only” sends each coach their own; “the whole ministry” sends one copy of everything. Recipients are worked out when it sends.'] },
  { id: 'w7', title: 'Keep the season on rails', mins: 5, href: '/dashboard/season-plan?tab=groups', go: 'Show me on the phone',
    why: 'Nine weeks go fast, and the small group guide is what students remember.',
    steps: ['The meeting dates set the week number across the whole app.', 'Build a small group guide per week; leaders play it screen by screen.', 'Open the awards you want voted on, and set when voting closes.'] },
  { id: 'w8', title: 'Give people the right access', mins: 3, href: '/dashboard/access-requests', go: 'Show me on the phone',
    why: 'Most of the mess in a ministry app is somebody seeing what they shouldn’t.',
    steps: ['Approve access by role, not by person — the role decides what they can see.', 'Coaches get their squad. Captains get who is missing. Families get their own link.', 'The parent board link is read-only and can be replaced any time.'] }
];

export interface SetupCheck {
  label: string;
  done: boolean;
  hint: string;
  href: string;
}

export function setupChecks(d: MinistryData): SetupCheck[] {
  const c = d.config;
  const rules = !!c.gameSetup.rulesText.trim();
  return [
    { label: 'Squads named and coloured', done: d.teams.length > 0, hint: d.teams.length + ' squads', href: '/console?tab=teams' },
    { label: 'Point categories set', done: d.cats.length > 0, hint: d.cats.length + ' categories', href: '/console?tab=scoring' },
    { label: 'Verse board set for the week', done: !!(c.versePts && c.verseBoard), hint: c.versePts + ' per verse · ' + c.verseBoard + ' board bonus', href: '/console?tab=setup' },
    { label: 'Roster in the app', done: d.roster.length > 0, hint: d.roster.length + ' students', href: '/console?tab=teams' },
    { label: 'Meeting dates picked', done: c.meetingDates.length > 0, hint: c.meetingDates.length + ' nights', href: '/console?tab=setup' },
    { label: 'Game rules posted', done: rules, hint: rules ? 'posted' : 'nothing posted yet', href: '/console?tab=scoring' },
    { label: 'Weekly reports scheduled', done: (d.deliveries ?? []).some((x) => x.on), hint: (d.deliveries ?? []).filter((x) => x.on).length + ' sending', href: '/console?tab=reports' },
    { label: 'Small group guide ready', done: d.smallGroups.length > 0, hint: d.smallGroups.length + ' guides', href: '/dashboard/season-plan?tab=groups' }
  ];
}
