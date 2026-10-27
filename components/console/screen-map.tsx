'use client';
/* The screen map — every screen and who can open it, printed from
   lib/screen-map.ts: the same table the More menu reads its rows from and a
   test checks against every route's own gate, so this sheet can't drift. */
import { Fragment, type ReactNode } from 'react';
import { Section } from '@/components/console/kit';
import { PrintButton, PrintSheet } from '@/components/console/print-sheet';
import { Icon } from '@/components/ui';
import { MORE_GROUPS, MORE_ROWS, NAV_NOTES, NESTED, OVERLAYS, PLANNER_NAV, ROUTES, TAB_NOTES, moreRowShows, tabBar, type MoreRow, type Route } from '@/lib/screen-map';
import { PERSONAS } from '@/lib/types/domain';

const short = (label: string) => label.replace('Organization ', '').replace('Ministry ', '').replace('Team ', '');
const cols = PERSONAS.map((p) => ({ id: p.id, label: short(p.label) }));
const SLOTS = ['Home', 'Your role', 'Centre', 'Chat', 'More'];

export function ScreenMap({ consoleTabs }: { consoleTabs: readonly { label: string }[] }) {
  const body = <MapBody consoleTabs={consoleTabs} />;
  return (
    <Section
      title="Screen map"
      sub="Five tabs carry the app; everything else hangs off More, grouped by when you’d reach for it. A row a role can see is a screen it can open — this is read off the same table the menu and every screen’s gate use."
      right={<PrintButton />}
    >
      {body}
      <PrintSheet title="Screen map — every screen in SquadRise and who can open it">{body}</PrintSheet>
    </Section>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead>
      <tr>
        <th className="px-3 py-2 text-[11px] font-normal text-neutral-500">{first}</th>
        {cols.map((c) => (
          <th key={c.id} className="border-l border-neutral-800 px-2 py-2 text-center text-[11.5px] font-medium text-neutral-200">
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[760px] border-collapse text-left">{children}</table>
    </div>
  );
}

const sub = 'mt-2 text-[13px] font-medium text-neutral-100';

function MapBody({ consoleTabs }: { consoleTabs: readonly { label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={sub}>The tab bar</div>
      <Table label="The tab bar, by role">
        <Head first="Slot" />
        <tbody>
          {SLOTS.map((slot, i) => (
            <tr key={slot} className="border-t border-neutral-800">
              <td className="px-3 py-[7px]">
                <div className="text-[12.5px] text-neutral-100">{slot}</div>
                <div className="text-[10.5px] leading-[1.4] text-neutral-500">{TAB_NOTES[i]}</div>
              </td>
              {cols.map((c) => (
                <td key={c.id} className="border-l border-neutral-800 px-1 text-center text-[11.5px] text-neutral-200">
                  {tabBar(c.id)[i].label}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>

      <div className={sub}>The More index</div>
      <Table label="The More index, by role">
        <Head first="Row" />
        <tbody>
          {MORE_GROUPS.map((g) => (
            <Fragment key={g.title}>
              <tr className="border-t border-neutral-800">
                <th colSpan={cols.length + 1} scope="colgroup" className="px-3 pb-[5px] pt-[10px] text-left text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                  {g.title} · {g.rows.length} rows{g.gate !== 'any' ? ' · the whole group needs ' + g.gate : ''}
                </th>
              </tr>
              {g.rows.map((id) => {
                const r: MoreRow = MORE_ROWS[id];
                return (
                  <tr key={id} className="border-t border-neutral-800">
                    <td className="px-3 py-[6px]">
                      <div className="flex items-center gap-2 text-[12.5px] text-neutral-100">
                        <Icon name={r.icon} className="text-[14px] text-accent-400" />
                        {r.label}
                      </div>
                      <div className="font-mono text-[10px] text-neutral-500">
                        {r.gate}
                        {r.unless ? ' · not ' + r.unless : ''}
                        {r.mode === 'demo' ? ' · demo only' : r.mode === 'live' ? ' · real ministry only' : ''}
                        {r.href ? ' · ' + r.href : ' · an action'}
                      </div>
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} className="border-l border-neutral-800 text-center">
                        {moreRowShows(id, c.id, r.mode !== 'live') ? (
                          <>
                            <Icon name="ph-fill ph-check-circle" className="text-[15px] text-accent-300" />
                            <span className="sr-only">Shows</span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true" className="text-neutral-700">·</span>
                            <span className="sr-only">Hidden</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>

      <div className="sr-break grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className={sub}>Reached from inside another screen</div>
          <ul className="flex flex-col rounded-lg border border-neutral-800">
            {NESTED.map((n) => (
              <li key={n.label} className="flex items-baseline gap-2 border-t border-neutral-800 px-3 py-[7px] first:border-t-0">
                <span className="flex-1 text-[12.5px] text-neutral-100">{n.label}</span>
                <span className="text-right text-[11px] text-neutral-500">
                  from {n.from}
                  {n.href ? <span className="font-mono text-[10px]"> · {ROUTES[n.href as Route]}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <div className={sub}>The overlay layer — no route of its own</div>
          <div className="flex flex-wrap gap-[6px]">
            {OVERLAYS.map((o) => (
              <span key={o} className="rounded-full border border-neutral-800 px-[10px] py-1 text-[11.5px] text-neutral-300">
                {o}
              </span>
            ))}
          </div>
          <div className={sub}>How moving around behaves</div>
          <ul className="flex list-disc flex-col gap-[6px] pl-5 text-[12px] leading-[1.55] text-neutral-400">
            {NAV_NOTES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sr-break flex flex-col gap-2">
        <div className={sub}>On the desk — leaders only, never reachable as a phone screen</div>
        <div className="rounded-lg border border-neutral-800">
          <div className="flex items-baseline gap-2 px-3 py-[7px]">
            <span className="w-[130px] flex-none text-[12.5px] text-neutral-100">Console</span>
            <span className="font-mono text-[10px] text-neutral-500">{ROUTES['/console']}</span>
            <span className="flex-1 text-[11.5px] leading-[1.5] text-neutral-400">{consoleTabs.length + ' tabs: ' + consoleTabs.map((t) => t.label).join(', ') + '.'}</span>
          </div>
          {PLANNER_NAV.map((n) => (
            <div key={n.href} className="flex items-baseline gap-2 border-t border-neutral-800 px-3 py-[7px]">
              <span className="w-[130px] flex-none text-[12.5px] text-neutral-100">Planner · {n.label}</span>
              <span className="font-mono text-[10px] text-neutral-500">{ROUTES[n.href]}</span>
              <span className="flex-1 text-[11.5px] leading-[1.5] text-neutral-400">{n.what}</span>
            </div>
          ))}
          <div className="flex items-baseline gap-2 border-t border-neutral-800 px-3 py-[7px]">
            <span className="w-[130px] flex-none text-[12.5px] text-neutral-100">Projector</span>
            <span className="font-mono text-[10px] text-neutral-500">{ROUTES['/projector']}</span>
            <span className="flex-1 text-[11.5px] leading-[1.5] text-neutral-400">The room’s second screen. Event control only — the same gate as the game timer.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
