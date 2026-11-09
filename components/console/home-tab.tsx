'use client';
/* CONSOLE · HOME — where the console opens: who you are here, where the
   season stands, what's waiting on you, the planner, the walkthrough, and
   one file with everything in it. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Section, useSaveConfig } from '@/components/console/kit';
import { startDeskTour } from '@/components/planner/desk-tour';
import { Btn, Icon } from '@/components/ui';
import { isoDay, nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { importLine, readTemplates } from '@/lib/templates';
import { useApp, useAppApi } from '@/lib/store/provider';
import { personaDef } from '@/lib/types/domain';
import { DEFAULT_EVENT_TYPES, type MinistryData } from '@/lib/types/model';

/** Everything the console can see, as one JSON file to keep or hand on. */
function exportEverything(data: unknown, ministry: string) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'SquadRise', data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ministry.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + isoDay(new Date()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* The template library: everything saved to use again, in five folders.
   It carries no students and no families — run sheets go without who runs
   each block — so it can go to the next youth pastor or another ministry. */
function templateFolders(d: MinistryData) {
  return [
    { id: 'games', label: 'Games', icon: 'ph ph-game-controller', href: '/console?tab=scoring', items: d.config.gameTemplates ?? [] },
    { id: 'smallgroups', label: 'Small group', icon: 'ph ph-chats-circle', href: '/console?tab=groups', items: d.config.sgTemplates ?? [] },
    { id: 'nights', label: 'Night outlines', icon: 'ph ph-list-checks', href: '/console?tab=huddle', items: d.savedNights.map((n) => ({ ...n, items: n.items.map((it) => ({ ...it, who: '', assignedTo: null, notifiedAt: null })) })) },
    { id: 'events', label: 'Event types', icon: 'ph ph-calendar-star', href: '/console?tab=calendar', items: d.config.eventTypes ?? DEFAULT_EVENT_TYPES },
    { id: 'seasons', label: 'Season builds', icon: 'ph ph-flag-banner', href: '/console?tab=season', items: d.seasons.map((s) => ({ name: s.name, answers: s.answers, plan: s.plan ?? null })) }
  ];
}

function exportTemplates(d: MinistryData): number {
  const folders = templateFolders(d);
  const total = folders.reduce((n, f) => n + f.items.length, 0);
  if (!total) return 0;
  const body = { app: 'SquadRise', kind: 'templates', ministry: d.config.ministryName, exportedAt: new Date().toISOString(), folders: Object.fromEntries(folders.map((f) => [f.id, f.items])) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'squadrise-templates-' + isoDay(new Date()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return total;
}

export function HomeTab() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const router = useRouter();
  const saveConfig = useSaveConfig();
  const c = d.config;
  /* Another ministry's templates, added beside ours. */
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    let raw: unknown = null;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      /* not JSON — said below */
    }
    const got = readTemplates(raw, api().data.config, api().data.seasons, uid, nowMs());
    if (!got) return api().say('That file isn’t a SquadRise template export. Export one from Console › Home, then import it here.');
    const line = importLine(got.counts);
    if (!line) return api().say(got.counts.nights ? 'Only night outlines in that file — those are dated to another ministry’s nights, so they stay out.' : 'Nothing in that file to bring in.');
    saveConfig(got.config, 'Imported templates: ' + line);
    api().mutate((x) => void (x.seasons = got.seasons));
    api().emit({ kind: 'doc', key: 'seasons', value: got.seasons });
    api().say('Imported ' + line + '.' + (got.counts.nights ? ' Night outlines stay out — they’re dated to another ministry’s nights.' : ''));
  };
  const pendingPoints = d.ledger.filter((e) => e.status === 'pending').length;
  const access = d.accessRequests.filter((r) => r.status === 'pending').length;
  const swaps = d.serving.swaps.filter((s) => s.status === 'pending').length;
  const waiting = [
    pendingPoints ? { label: pendingPoints + (pendingPoints === 1 ? ' point request' : ' point requests'), href: '/dashboard/approvals' } : null,
    access ? { label: access + (access === 1 ? ' person' : ' people') + ' asking for access', href: '/console?tab=people' } : null,
    swaps ? { label: swaps + (swaps === 1 ? ' swap request' : ' swap requests'), href: '/planner/people' } : null
  ].filter((x): x is { label: string; href: string } => !!x);
  const stats = [
    { label: 'This season', value: 'Week ' + c.weekNumber + ' of ' + c.seasonWeeks, hint: c.seasonName ?? 'Season dates in Setup', href: '/console?tab=setup' },
    { label: 'Students', value: String(d.roster.filter((s) => !s.guest).length), hint: d.roster.filter((s) => !s.team).length + ' without a squad', href: '/console?tab=draft' },
    { label: 'Waiting on you', value: String(pendingPoints + access + swaps), hint: waiting.length ? 'approvals, access and swaps' : 'nothing right now', href: '/dashboard/approvals' }
  ];
  const quick = [
    { label: 'Score a squad', meta: 'award points live', icon: 'ph ph-lightning', href: '/dashboard/score' },
    { label: 'Approval queue', meta: pendingPoints + ' waiting', icon: 'ph ph-check-square', href: '/dashboard/approvals' },
    { label: 'Projector', meta: 'the room screen', icon: 'ph ph-monitor-play', href: '/projector' },
    { label: 'Public board', meta: 'for parents, no sign-in', icon: 'ph ph-presentation-chart', href: '/dashboard/parent-link' }
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] text-neutral-400">
        You’re signed in as <span className="text-neutral-100">{personaDef(m.persona).label}</span> at <span className="text-neutral-100">{c.ministryName}</span>
        {m.mode === 'demo' ? ' (the demo)' : ''}.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="sr-card flex flex-col gap-1 px-4 py-3 hover:border-neutral-700">
            <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-400">{s.label}</span>
            <span className="tabular text-[22px] font-medium text-neutral-100">{s.value}</span>
            <span className="text-[12px] text-neutral-400">{s.hint}</span>
          </Link>
        ))}
      </div>

      {waiting.length ? (
        <Section title="Waiting on you">
          {waiting.map((w) => (
            <Link key={w.href} href={w.href} className="flex min-h-11 items-center gap-3 border-t border-divider text-[13.5px] text-neutral-100 first:border-t-0">
              <span className="flex-1">{w.label}</span>
              <Icon name="ph ph-caret-right" className="text-[13px] text-neutral-500" />
            </Link>
          ))}
        </Section>
      ) : null}

      <section className="sr-dark flex flex-col gap-3 rounded-lg px-5 py-4" style={{ background: 'linear-gradient(160deg,var(--color-section) 0%,#1d2044 80%)' }}>
        <div className="flex items-baseline gap-3">
          <h2 className="flex-1 text-[15px] font-medium text-neutral-100">Seven-year planner</h2>
          <span className="rounded-full border border-accent-600 px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-[.1em] text-accent-200">{d.plan.items.length ? d.plan.items.length + ' items' : 'not started'}</span>
        </div>
        <p className="text-[13px] leading-[1.55] text-neutral-300 text-pretty">Plan the whole horizon from a desk: seven years of lanes, one ministry year month by month, and every season down to the run sheet, the volunteers and the debrief.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: 'Seven-year roadmap', meta: 'lanes across seven years, or one class down them', href: '/planner/roadmap' },
            { label: 'Ministry year', meta: 'one year, month by month', href: '/planner/year' },
            { label: 'Season, month and night', meta: 'down to the run sheet and the debrief', href: '/planner/season' },
            { label: d.plan.settings.setupAt ? 'Planner settings' : 'Set up the plan', meta: d.plan.settings.setupAt ? 'lanes, blocks, seasons' : 'six short steps', href: d.plan.settings.setupAt ? '/planner/settings' : '/planner/setup' }
          ].map((x) => (
            <Link key={x.href} href={x.href} className="flex flex-col rounded-md border border-white/10 px-3 py-2 hover:border-white/20">
              <span className="text-[13.5px] font-medium text-neutral-100">{x.label}</span>
              <span className="text-[12px] text-neutral-400">{x.meta}</span>
            </Link>
          ))}
        </div>
        <Btn variant="secondary" className="self-start px-4" href="/planner">
          Open the planner
        </Btn>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="New to this?" sub="The walkthrough is written for your first month, in the order a week actually happens. The leader tour walks the planner screen by screen.">
          <div className="flex flex-wrap gap-2">
            <Btn className="px-4" href="/console?tab=walkthrough">
              Start the walkthrough
            </Btn>
            <Btn
              variant="ghost"
              className="px-3 text-accent-300"
              onClick={() => {
                startDeskTour();
                router.push('/planner');
              }}
            >
              Leader tour on the planner
            </Btn>
          </div>
        </Section>
        <Section title="Everything, in one file" sub="Squads, roster, points, the season, the plan, the library you placed, reports and settings. Keep it as a backup, or hand it to the next youth pastor. It holds each family’s private link, so keep it somewhere safe.">
          <Btn
            variant="secondary"
            className="self-start px-4"
            onClick={() => {
              exportEverything(api().data, c.ministryName);
              api().logActivity('Exported everything · ' + m.displayName);
            }}
          >
            <Icon name="ph ph-download-simple" className="mr-[6px] text-[14px]" />
            Export everything
          </Btn>
        </Section>
      </div>

      <Section
        title="Your template library"
        sub="Everything you’ve saved to use again, in one place. Export takes the templates as a file with no students or families in it — keep it, or hand it to another ministry."
        right={<span className="text-[11.5px] font-medium text-accent-200">{templateFolders(d).reduce((n, f) => n + f.items.length, 0)} saved</span>}
      >
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {templateFolders(d).map((f) => (
            <Link key={f.id} href={f.href} className="flex min-h-11 flex-col gap-1 rounded-md border border-neutral-800 px-3 py-[10px] hover:border-accent-600">
              <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
                <Icon name={f.icon} className="text-[15px] text-accent-300" />
                {f.label}
              </span>
              <span className="text-[11.5px] text-neutral-500">{f.items.length ? f.items.length + ' saved' : 'nothing yet'}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            className="px-4"
            onClick={() => {
              const n = exportTemplates(api().data);
              if (!n) return api().say('Nothing saved yet — save a game or a night first.');
              api().logActivity('Exported the template library — ' + n + ' templates');
              api().say(n + (n === 1 ? ' template' : ' templates') + ' exported.');
            }}
          >
            <Icon name="ph ph-export" className="mr-[6px] text-[14px]" />
            Export the templates
          </Btn>
          <label className="btn btn-ghost min-h-11 cursor-pointer px-4">
            <Icon name="ph ph-download-simple" className="mr-[6px] text-[14px]" />
            Import templates
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void importFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          </label>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.label} href={q.href} className="sr-card flex items-center gap-3 px-4 py-3 hover:border-neutral-700">
            <Icon name={q.icon} className="text-[18px] text-accent-300" />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-neutral-100">{q.label}</span>
              <span className="block truncate text-[12px] text-neutral-400">{q.meta}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
