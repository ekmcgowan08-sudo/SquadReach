'use client';
/* Reports: the season as spreadsheets. Each one is built from the same rows
   the app reads — nothing here is a stored total. */
import { ReportViews } from '@/components/console/report-views';
import { Section } from '@/components/console/kit';
import { DeliveriesSection, ReportBuilderSection } from '@/components/console/report-builder';
import { Btn, Icon } from '@/components/ui';
import { downloadCsv, toCsv } from '@/lib/csv';
import { bibleStats } from '@/lib/bible';
import { isoDay } from '@/lib/dates';
import { categoryTotals, standings, studentRanks } from '@/lib/scoring';
import { catOf, computeBadges, teamOf } from '@/lib/selectors';
import { useApp } from '@/lib/store/provider';

export function ReportsTab() {
  const d = useApp((s) => s.data);
  const stamp = isoDay(new Date());
  const slug = d.config.ministryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ministry';
  const file = (what: string) => slug + '-' + what + '-' + stamp + '.csv';

  const reports = [
    {
      id: 'standings',
      icon: 'ph ph-ranking',
      title: 'Standings by category',
      sub: 'Each squad’s total and what it is made of — the board, as a table.',
      run: () =>
        downloadCsv(
          file('standings'),
          toCsv(
            ['Rank', 'Squad', 'Total', ...d.cats.map((c) => c.label)],
            standings(d.teams, d.cats, d.ledger).map((t, i) => {
              const cat = categoryTotals(d.ledger, t.id);
              return [i + 1, t.name, t.total, ...d.cats.map((c) => cat[c.id] ?? 0)];
            })
          )
        )
    },
    {
      id: 'ledger',
      icon: 'ph ph-list-checks',
      title: 'Full points ledger',
      sub: 'Every entry with who, when, why and what was decided — the audit trail.',
      run: () =>
        downloadCsv(
          file('ledger'),
          toCsv(
            ['When', 'Squad', 'Category', 'Amount', 'Status', 'Student', 'Reason', 'Entered by', 'Decided by', 'Reverses'],
            [...d.ledger]
              .sort((a, b) => a.at - b.at)
              .map((e) => [new Date(e.at).toISOString(), teamOf(d, e.team).name, catOf(d, e.cat).label, e.amount, e.status, e.student ?? '', e.why, e.by, e.decidedBy ?? '', e.reverses ?? ''])
          )
        )
    },
    {
      id: 'students',
      icon: 'ph ph-student',
      title: 'Individual points',
      sub: 'Every student’s season total, squad, grade and streaks.',
      run: () => {
        const badges = computeBadges(d);
        downloadCsv(
          file('students'),
          toCsv(
            ['Rank', 'Student', 'Squad', 'Grade', 'Points', 'Attendance streak (wks)', 'Bible streak (days)', 'Badge'],
            studentRanks(d.roster, d.ledger, d.studentSeedPoints).map((r, i) => {
              const s = d.roster.find((x) => x.name === r.name);
              const b = badges.find((x) => x.name === r.name);
              return [i + 1, r.name, teamOf(d, r.team).name, s?.grade ?? '', r.total, b?.attendStreak ?? 0, b?.bibleStreak ?? 0, b?.tier ?? ''];
            })
          )
        );
      }
    },
    {
      id: 'attendance',
      icon: 'ph ph-calendar-check',
      title: 'Attendance by week',
      sub: 'Percent of each roster present on each meeting night.',
      run: () =>
        downloadCsv(
          file('attendance'),
          toCsv(
            ['Squad', 'Roster', ...Array.from({ length: d.config.seasonWeeks }, (_, i) => 'Week ' + (i + 1) + (d.config.meetingDates[i] ? ' (' + d.config.meetingDates[i] + ')' : ''))],
            d.teams.map((t) => [t.name, d.roster.filter((r) => r.team === t.id).length, ...Array.from({ length: d.config.seasonWeeks }, (_, i) => (i + 1 <= d.config.weekNumber ? (d.attendanceHistory[t.id]?.[i] ?? '') : ''))])
          )
        )
    },
    {
      id: 'practice',
      icon: 'ph ph-book-open-text',
      title: 'Bible practice',
      sub: 'Who practiced, how often, and their streak — never a score.',
      run: () => {
        const who = [...new Set(d.practiceLog.map((r) => r.who))];
        downloadCsv(
          file('bible-practice'),
          toCsv(
            ['Name', 'Practices', 'Verses touched', 'Current streak (days)', 'Last practiced'],
            who.map((w) => {
              const rows = d.practiceLog.filter((r) => r.who === w);
              const st = bibleStats(rows, d.config.memoryVerses, d.config.weekNumber);
              return [w, rows.length, st.verses, st.streak, rows.map((r) => r.day).sort().pop() ?? ''];
            })
          )
        );
      }
    },
    {
      id: 'rsvps',
      icon: 'ph ph-users-three',
      title: 'Event RSVPs',
      sub: 'Who answered for each event, with guests — for food orders and rides.',
      run: () =>
        downloadCsv(
          file('rsvps'),
          toCsv(
            ['Event', 'Date', 'Name', 'Answer', 'Guests'],
            d.events.flatMap((e) => Object.entries(d.rsvps[e.id] ?? {}).map(([name, r]) => [e.title, e.iso ?? e.date, name, r.status, r.guests]))
          )
        )
    }
  ];

  return (
    <>
    <ReportBuilderSection />
    <DeliveriesSection />
    <Section title="Quick downloads" sub="The season as spreadsheets. They open in Excel, Numbers or Google Sheets.">
      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
            <div className="flex items-center gap-2">
              <Icon name={r.icon} className="text-[17px] text-accent-400" />
              <div className="text-[13.5px] font-medium text-neutral-100">{r.title}</div>
            </div>
            <div className="flex-1 text-[12px] leading-[1.5] text-neutral-500 text-pretty">{r.sub}</div>
            <Btn variant="secondary" className="self-start px-3" onClick={r.run}>
              <Icon name="ph ph-download-simple" className="mr-[6px] text-[14px]" />
              Download CSV
            </Btn>
          </div>
        ))}
            </div>
    </Section>
    <ReportViews />
    </>
  );
}
