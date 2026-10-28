'use client';
/* Console · Reports: the pastor's own reports (built from five decisions,
   with the real result recomputed on every change) and the delivery
   schedule. */
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { Btn, Icon } from '@/components/ui';
import { downloadCsv, toCsv } from '@/lib/csv';
import { isoDay, nowMs } from '@/lib/dates';
import {
  AUDIENCES, CADENCES, DAYS, REPORT_KINDS, REPORT_OPS, REPORT_PRESETS, REPORT_SOURCES, deliveryDue, deliveryRecipientGroups, deliverySent, deliverySentence,
  reportSpec, runReport, sourceOf
} from '@/lib/report-builder';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';
import type { CustomReport, Delivery, MinistryData } from '@/lib/types/model';

const blank = (): CustomReport => ({ id: uid(), name: 'New report', source: 'students', columns: ['name', 'squad', 'points'], filters: [], groupBy: null, sort: null, at: nowMs() });

export function ReportBuilderSection() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const [r, setR] = useState<CustomReport | null>(null);
  const saveAll = (list: CustomReport[]) => {
    api().mutate((x) => void (x.customReports = list));
    api().emit({ kind: 'doc', key: 'customReports', value: list });
  };

  if (r) return <Builder report={r} setReport={setR} onSave={(rep) => {
    const exists = d.customReports.some((x) => x.id === rep.id);
    saveAll(exists ? d.customReports.map((x) => (x.id === rep.id ? rep : x)) : [rep, ...d.customReports]);
    api().logActivity('Saved report: ' + rep.name);
    api().say('Saved. You can schedule it below.');
    setR(null);
  }} onDelete={(id) => {
    saveAll(d.customReports.filter((x) => x.id !== id));
    setR(null);
  }} />;

  return (
    <Section
      title="Your reports"
      sub="Anything you need that isn’t already a report, build: what it reads, which columns, what to leave out, how to group, how to order. Saved reports can go on the delivery schedule."
      right={
        <Btn className="px-3" onClick={() => setR(blank())}>
          + New report
        </Btn>
      }
    >
      {d.customReports.length ? (
        <div className="flex flex-col gap-2">
          {d.customReports.map((c) => (
            <button key={c.id} onClick={() => setR({ ...c })} className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-800 px-3 py-2 text-left sr-hover">
              <Icon name="ph ph-table" className="text-[16px] text-accent-300" />
              <span className="flex-1 text-[13px] font-medium text-neutral-100">{c.name}</span>
              <span className="text-[11px] text-neutral-500">
                {sourceOf(c.source).label} · {runReport(d, c).rows.length} rows
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <div>
        <div className="sr-label mb-2">Start from one of these</div>
        <div className="flex flex-wrap gap-2">
          {REPORT_PRESETS.map((p) => (
            <button key={p.name} onClick={() => setR({ ...p, id: uid(), at: nowMs() })} className="min-h-9 rounded-full border border-neutral-700 px-3 text-[12px] text-neutral-300">
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Builder({ report, setReport, onSave, onDelete }: { report: CustomReport; setReport: (r: CustomReport | null) => void; onSave: (r: CustomReport) => void; onDelete: (id: string) => void }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const src = sourceOf(report.source);
  const res = runReport(d, report);
  const set = (p: Partial<CustomReport>) => setReport({ ...report, ...p });
  const kindOf = (id: string) => src.fields.find((x) => x.id === id)?.kind ?? 'text';
  const saved = d.customReports.some((x) => x.id === report.id);
  const csv = () => toCsv(res.columns.map((c) => c.label), res.rows.map((row) => res.columns.map((c) => row[c.id] ?? '')));

  return (
    <Section
      title={saved ? 'Edit report' : 'Build a report'}
      sub="The table underneath is the real result, recomputed as you change anything."
      right={
        <Btn variant="ghost" className="px-3" onClick={() => setReport(null)}>
          Close
        </Btn>
      }
    >
      <label className="field">
        <span className="sr-label">Name</span>
        <input className="input max-w-[420px]" value={report.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="sr-label">1 · What it reads</div>
          <select
            className="input"
            value={report.source}
            onChange={(e) => {
              /* A filter left pointing at a field the new source doesn't have
                 returns nothing, which reads as "no problems here" — so
                 switching the source resets columns and filters on purpose. */
              const next = sourceOf(e.target.value);
              set({ source: next.id, columns: next.fields.slice(0, 4).map((x) => x.id), filters: [], groupBy: null, sort: null });
            }}
            aria-label="Source"
          >
            {REPORT_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
          <div className="sr-label mt-2">2 · Which columns</div>
          <div className="flex flex-wrap gap-[6px]">
            {src.fields.map((x) => {
              const on = report.columns.includes(x.id);
              return (
                <button
                  key={x.id}
                  onClick={() => set({ columns: on ? report.columns.filter((c) => c !== x.id) : [...report.columns, x.id] })}
                  aria-pressed={on}
                  className="min-h-9 rounded-full border px-3 text-[12px]"
                  style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
                >
                  {x.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="sr-label">3 · What to leave out</div>
          {report.filters.map((flt, i) => {
            const kind = kindOf(flt.field);
            const op = REPORT_OPS[kind].find((o) => o.id === flt.op) ?? REPORT_OPS[kind][0];
            const patch = (p: Partial<typeof flt>) => set({ filters: report.filters.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-neutral-500">Only rows where</span>
                <select className="input !min-h-9 !w-auto !py-0" value={flt.field} onChange={(e) => patch({ field: e.target.value, op: REPORT_OPS[kindOf(e.target.value)][0].id, value: '' })} aria-label="Field">
                  {src.fields.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <select className="input !min-h-9 !w-auto !py-0" value={op.id} onChange={(e) => patch({ op: e.target.value })} aria-label="Operator">
                  {REPORT_OPS[kind].map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!op.none ? <input className="input !min-h-9 !w-[120px] !py-0" type={kind === 'num' ? 'number' : 'text'} value={flt.value} onChange={(e) => patch({ value: e.target.value })} aria-label="Value" /> : null}
                <button aria-label="Remove filter" onClick={() => set({ filters: report.filters.filter((_, j) => j !== i) })} className="h-9 w-9 rounded-full text-neutral-500">
                  <Icon name="ph ph-x" className="text-[13px]" />
                </button>
              </div>
            );
          })}
          <button onClick={() => set({ filters: [...report.filters, { field: src.fields[0].id, op: REPORT_OPS[src.fields[0].kind][0].id, value: '' }] })} className="self-start text-[12px] font-medium text-accent-300">
            + Add a condition
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="field">
              <span className="sr-label">4 · Group by</span>
              <select className="input" value={report.groupBy ?? ''} onChange={(e) => set({ groupBy: e.target.value || null })}>
                <option value="">No grouping</option>
                {src.fields
                  .filter((x) => x.kind !== 'num')
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span className="sr-label">5 · Order by</span>
              <div className="flex gap-1">
                <select className="input flex-1" value={report.sort?.field ?? ''} onChange={(e) => set({ sort: e.target.value ? { field: e.target.value, dir: report.sort?.dir ?? 'desc' } : null })}>
                  <option value="">As it comes</option>
                  {[...src.fields, ...(report.groupBy ? [{ id: 'rows', label: 'Rows' }] : [])].map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                {report.sort ? (
                  <button onClick={() => set({ sort: { ...report.sort!, dir: report.sort!.dir === 'asc' ? 'desc' : 'asc' } })} className="min-h-11 rounded-md border border-neutral-800 px-2 text-[12px] text-neutral-300" aria-label="Flip order">
                    {report.sort.dir === 'asc' ? 'A→Z' : 'Z→A'}
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 text-[12px] text-neutral-400">
          {res.rows.length} {res.rows.length === 1 ? 'row' : 'rows'}
          {report.groupBy ? ' · from ' + res.matched + ' matching' : ''}
        </div>
        <Btn
          variant="secondary"
          className="px-3 text-[12px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(csv());
              api().say('Copied — paste it into a spreadsheet.');
            } catch {
              api().say('Copy failed — use Download instead.');
            }
          }}
        >
          Copy as CSV
        </Btn>
        <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => downloadCsv((report.name || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + isoDay(new Date()) + '.csv', csv())}>
          Download
        </Btn>
        {saved ? (
          <Btn variant="ghost" className="px-3 text-[12px] text-neutral-400" onClick={() => window.confirm('Delete ' + report.name + '?') && onDelete(report.id)}>
            Delete
          </Btn>
        ) : null}
        <Btn className="px-4" disabled={!report.name.trim()} onClick={() => onSave({ ...report, name: report.name.trim(), at: nowMs() })}>
          Save report
        </Btn>
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border border-neutral-800">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {res.columns.map((c) => (
                <th key={c.id} className="whitespace-nowrap border-b border-neutral-800 px-3 py-2 font-medium text-neutral-400">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {res.rows.slice(0, 200).map((row, i) => (
              <tr key={i} className="border-b border-divider last:border-b-0">
                {res.columns.map((c) => (
                  <td key={c.id} className={'px-3 py-[7px] text-neutral-200 ' + (c.kind === 'num' ? 'tabular text-right' : '')}>
                    {String(row[c.id] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!res.rows.length ? <div className="px-3 py-6 text-center text-[12px] text-neutral-500">Nothing matches. Loosen a condition.</div> : null}
        {res.rows.length > 200 ? <div className="px-3 py-2 text-[11px] text-neutral-500">Showing 200 of {res.rows.length}. The download has all of them.</div> : null}
      </div>
    </Section>
  );
}

type EmailRec = NonNullable<MinistryData['reportEmails']>[number];
const lastEmail = (d: MinistryData, id: string) => d.reportEmails?.find((x) => x.delivery === id);
/** What the last email send did, in a line. */
function emailLine(r: EmailRec) {
  const when = new Date(r.at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (r.status === 'skipped' || r.status === 'failed') return 'Email didn’t go out (' + when + '): ' + (r.error ?? 'unknown reason') + (r.status === 'skipped' ? ' It still went to notifications.' : '');
  if (r.status === 'sending') return 'Emailing since ' + when + '…';
  return 'Emailed ' + r.sent + (r.sent === 1 ? ' person' : ' people') + ' · ' + when + (r.by !== 'Schedule' ? ' · by ' + r.by : '') + (r.missing.length ? ' · no email on file for ' + r.missing.join(', ') : '');
}

export function DeliveriesSection() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const now = useNow(true, 60_000);
  const [openId, setOpenId] = useState<string | null>(null);
  const saveAll = (list: Delivery[]) => {
    api().mutate((x) => void (x.deliveries = list));
    api().emit({ kind: 'doc', key: 'deliveries', value: list });
  };
  const patch = (id: string, p: Partial<Delivery>) => saveAll(d.deliveries.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const reports = [...REPORT_KINDS.map((k) => ({ id: k.id, label: k.label })), ...d.customReports.map((c) => ({ id: c.id, label: c.name }))];
  const [busy, setBusy] = useState<string | null>(null);
  /** Supabase: the server emails it too, through the same once-per-period path. */
  const email = async (dl: Delivery) => {
    setBusy(dl.id);
    try {
      const r = await fetch('/api/deliveries/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dl.id }) });
      const out = (await r.json().catch(() => ({}))) as { status?: string; sent?: number; missing?: string[]; error?: string };
      const rec = { delivery: dl.id, period: 'manual', at: nowMs(), status: (out.status === 'already' ? 'sent' : out.status ?? 'failed') as 'sent' | 'failed' | 'skipped', sent: out.sent ?? 0, missing: out.missing ?? [], error: out.error ?? (r.ok ? null : 'The server said ' + r.status), by: m.displayName };
      api().mutate((x) => void (x.reportEmails = [rec, ...(x.reportEmails ?? [])].slice(0, 60)));
      api().say(emailLine(rec));
    } catch {
      api().say('Couldn’t reach the server to email it. It still went to notifications.');
    } finally {
      setBusy(null);
    }
  };
  const sendNow = (dl: Delivery) => {
    if (m.mode === 'supabase') void email(dl);
    const due = deliveryDue(d, dl, nowMs());
    const period = due?.period ?? 'manual:' + isoDay(new Date());
    const rec = { id: uid(), delivery: dl.id, period, at: nowMs(), by: m.displayName };
    const log = [rec, ...d.reportSendLog].slice(0, 100);
    api().mutate((x) => void (x.reportSendLog = log));
    api().emit({ kind: 'doc', key: 'reportSendLog', value: log });
    const groups = deliveryRecipientGroups(d, dl);
    api().logActivity('Sent now: ' + deliverySentence(d, dl) + ' — ' + groups.reduce((n, g) => n + g.names.length, 0) + ' people');
    api().notify(reportSpec(d, dl.report)?.label ?? 'Report', 'Sent to ' + groups.map((g) => g.label).join(', '), '/dashboard/notifications');
    if (m.mode !== 'supabase') api().say('Sent. It’s in each person’s notifications with a download.');
  };

  return (
    <Section
      title="Delivery schedule"
      sub="Each delivery is a report, who it goes to, and when. “Each their own squad” sends every squad its own copy. Who receives it is worked out when it goes out, so a trade or a new captain never leaves a stale list. It arrives in their notifications with a download."
      right={
        <Btn className="px-3" onClick={() => saveAll([...d.deliveries, { id: uid(), report: 'standings', audience: 'leaders', scope: 'all', cadence: 'weekly', day: 4, time: '09:00', on: true }])}>
          + Delivery
        </Btn>
      }
    >
      {!d.deliveries.length ? <div className="text-[12px] text-neutral-500">Nothing scheduled yet.</div> : null}
      {d.deliveries.map((dl) => {
        const groups = deliveryRecipientGroups(d, dl);
        const due = deliveryDue(d, dl, now);
        const sent = deliverySent(d, dl, now);
        const open = openId === dl.id;
        const squadAudience = dl.audience === 'coaches' || dl.audience === 'captains' || dl.audience === 'squadLeads';
        return (
          <div key={dl.id} className="flex flex-col gap-2 rounded-md border border-neutral-800 p-3" style={{ opacity: dl.on ? 1 : 0.6 }}>
            <div className="grid gap-2 sm:grid-cols-3">
              <select className="input !min-h-9 !py-0" value={dl.report} onChange={(e) => patch(dl.id, { report: e.target.value })} aria-label="Report">
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select className="input !min-h-9 !py-0" value={dl.audience} onChange={(e) => patch(dl.id, { audience: e.target.value as Delivery['audience'] })} aria-label="Audience">
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <select className="input !min-h-9 !py-0" value={squadAudience ? dl.scope : 'all'} disabled={!squadAudience} onChange={(e) => patch(dl.id, { scope: e.target.value as Delivery['scope'] })} aria-label="Scope">
                <option value="own">Each their own squad</option>
                <option value="all">The whole ministry</option>
              </select>
              <select className="input !min-h-9 !py-0" value={dl.cadence} onChange={(e) => patch(dl.id, { cadence: e.target.value as Delivery['cadence'], day: e.target.value === 'monthly' ? 1 : dl.day })} aria-label="Cadence">
                {CADENCES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {dl.cadence === 'weekly' ? (
                <select className="input !min-h-9 !py-0" value={dl.day} onChange={(e) => patch(dl.id, { day: Number(e.target.value) })} aria-label="Day">
                  {DAYS.map((x, i) => (
                    <option key={x} value={i}>
                      {x}
                    </option>
                  ))}
                </select>
              ) : dl.cadence === 'monthly' ? (
                <input className="input !min-h-9 !py-0" type="number" min={1} max={28} value={dl.day} onChange={(e) => patch(dl.id, { day: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })} aria-label="Day of month" />
              ) : dl.cadence === 'close' ? (
                <span className="self-center text-[11px] text-neutral-500">at the debrief</span>
              ) : (
                <span className="self-center text-[11px] text-neutral-500">after each night</span>
              )}
              {dl.cadence === 'close' ? (
                <span className="self-center text-[11px] leading-[1.35] text-neutral-500">the moment someone taps End the night</span>
              ) : (
                <input className="input !min-h-9 !py-0" type="time" value={dl.time} onChange={(e) => e.target.value && patch(dl.id, { time: e.target.value })} aria-label="Time" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 text-[11.5px] text-neutral-400">
                {dl.on
                  ? sent
                    ? dl.cadence === 'close'
                      ? 'Went out when tonight closed'
                      : 'Went out for this period'
                    : due
                      ? 'Next: ' + new Date(due.at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : dl.cadence === 'close'
                        ? 'Goes out when tonight closes'
                        : 'Waiting for the first night'
                  : 'Paused'}
                {' · '}
                {groups.reduce((n, g) => n + g.names.length, 0)} people
              </div>
              <button onClick={() => setOpenId(open ? null : dl.id)} aria-expanded={open} className="text-[12px] font-medium text-accent-300">
                {open ? 'Hide the list' : 'Who gets it'}
              </button>
              <Btn variant="secondary" className="px-3 text-[12px]" disabled={!dl.on || busy === dl.id} onClick={() => sendNow(dl)}>
                {busy === dl.id ? 'Sending…' : 'Send now'}
              </Btn>
              <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => patch(dl.id, { on: !dl.on })}>
                {dl.on ? 'Pause' : 'Turn on'}
              </Btn>
              <button aria-label="Remove delivery" onClick={() => window.confirm('Remove this delivery?') && saveAll(d.deliveries.filter((x) => x.id !== dl.id))} className="h-9 w-9 rounded-full text-neutral-500">
                <Icon name="ph ph-trash" className="text-[13px]" />
              </button>
            </div>
            {lastEmail(d, dl.id) ? <div className="text-[11.5px] leading-[1.5] text-neutral-500">{emailLine(lastEmail(d, dl.id)!)}</div> : null}
            {open ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g.label} className="rounded-md bg-neutral-900 px-3 py-2">
                    <div className="text-[11px] font-medium text-neutral-300">{g.label}</div>
                    <div className="mt-1 text-[11.5px] leading-[1.5] text-neutral-500">{g.names.join(', ') || 'Nobody yet — add a coach or captain to this squad.'}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {d.reportSendLog.length ? (
        <div className="text-[11px] leading-[1.5] text-neutral-500">
          Last sent by hand: {new Date(d.reportSendLog[0].at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} by {d.reportSendLog[0].by}
        </div>
      ) : null}
    </Section>
  );
}
