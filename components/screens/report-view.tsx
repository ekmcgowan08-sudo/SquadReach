'use client';
/* A scheduled report, as it reached you: your squad's copy (or the whole
   ministry's), built from today's data, with a download. You only see a
   copy you are on the list for — leaders can open any. */
import { useSearchParams } from 'next/navigation';
import { Btn, EmptyNote, Icon, Screen, ScreenHeader } from '@/components/ui';
import { downloadCsv, toCsv } from '@/lib/csv';
import { isoDay } from '@/lib/dates';
import { canApprove } from '@/lib/permissions';
import { deliveryRecipientGroups, deliverySentence, reportSpec, runReport, scopedSpec } from '@/lib/report-builder';
import { servingName } from '@/lib/selectors';
import { useApp } from '@/lib/store/provider';

export function ReportViewScreen() {
  const params = useSearchParams();
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const dl = d.deliveries.find((x) => x.id === params.get('d'));
  const team = params.get('team');
  const rep = dl ? reportSpec(d, dl.report) : null;
  const group = dl ? deliveryRecipientGroups(d, dl).find((g) => (g.team ?? null) === (team ?? null)) : undefined;
  const me = new Set([servingName(d, m), m.displayName, ...(m.studentName ? [m.studentName + ' (captain)'] : [])]);
  const allowed = canApprove(m.persona) || !!group?.names.some((n) => me.has(n));
  const squad = team ? (d.teams.find((t) => t.id === team)?.name ?? null) : null;

  if (!dl || !rep || !group || !allowed)
    return (
      <Screen label="Report">
        <ScreenHeader title="Report" back="/dashboard/notifications" />
        <EmptyNote>This report isn’t one that comes to you.</EmptyNote>
      </Screen>
    );
  const res = runReport(d, scopedSpec(rep.spec, squad));
  return (
    <Screen label="Report">
      <ScreenHeader title={rep.label} sub={(squad ? squad + ' · ' : '') + deliverySentence(d, dl)} back="/dashboard/notifications" />
      <Btn
        variant="secondary"
        className="justify-center"
        onClick={() => downloadCsv(rep.label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + (squad ? '-' + squad.toLowerCase() : '') + '-' + isoDay(new Date()) + '.csv', toCsv(res.columns.map((c) => c.label), res.rows.map((r) => res.columns.map((c) => r[c.id] ?? ''))))}
      >
        <Icon name="ph ph-download-simple" className="mr-[6px] text-[15px]" />
        Download as a spreadsheet
      </Btn>
      <div className="text-[11px] text-neutral-500">
        {res.rows.length} rows · built from today’s data, so it’s never stale
      </div>
      <div className="sr-card overflow-hidden">
        {res.rows.slice(0, 120).map((r, i) => (
          <div key={i} className="px-[14px] py-[9px]" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}>
            <div className="text-[13px] font-medium text-neutral-100">{String(r[res.columns[0].id] ?? '')}</div>
            <div className="mt-[2px] text-[11px] leading-[1.45] text-neutral-500">
              {res.columns
                .slice(1)
                .map((c) => c.label + ': ' + String(r[c.id] ?? '—'))
                .join(' · ')}
            </div>
          </div>
        ))}
        {!res.rows.length ? <div className="px-[14px] py-4 text-[12px] text-neutral-500">Nothing in it this time.</div> : null}
      </div>
    </Screen>
  );
}
