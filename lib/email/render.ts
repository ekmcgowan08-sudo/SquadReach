/* A delivered report as an email: a plain table in light colours (email
   clients ignore most CSS), a text twin, and a link back to the app. Every
   value is escaped; nothing from the ministry's data is trusted as HTML. */
import type { ReportResult } from '@/lib/report-builder';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const MAX_ROWS = 200;

export function renderReport(o: { ministry: string; report: string; copy: string; when: string; result: ReportResult; appUrl: string; to: string }) {
  const { result } = o;
  const rows = result.rows.slice(0, MAX_ROWS);
  const more = result.rows.length - rows.length;
  const subject = o.report + (o.copy === 'Whole ministry' ? '' : ' · ' + o.copy) + ' · ' + o.ministry;
  const cell = 'padding:6px 10px;border-bottom:1px solid #e4e4ea;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#24242f;text-align:left;vertical-align:top';
  const head = result.columns.map((c) => '<th style="' + cell + ';font-weight:600;color:#55556a;text-align:' + (c.kind === 'num' ? 'right' : 'left') + '">' + esc(c.label) + '</th>').join('');
  const body = rows
    .map((r) => '<tr>' + result.columns.map((c) => '<td style="' + cell + (c.kind === 'num' ? ';text-align:right;font-variant-numeric:tabular-nums' : '') + '">' + esc(r[c.id]) + '</td>').join('') + '</tr>')
    .join('');
  const html =
    '<!doctype html><html><body style="margin:0;background:#f6f6f9;padding:24px">' +
    '<div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e4e4ea;border-radius:10px;padding:24px">' +
    '<div style="font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b5fc7">' + esc(o.ministry) + '</div>' +
    '<h1 style="margin:8px 0 4px;font:500 22px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c26">' + esc(o.report) + '</h1>' +
    '<div style="font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#55556a;margin-bottom:16px">' + esc(o.copy) + ' · ' + esc(o.when) + ' · ' + result.rows.length + (result.rows.length === 1 ? ' row' : ' rows') + '</div>' +
    (rows.length
      ? '<table style="border-collapse:collapse;width:100%"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>'
      : '<p style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#55556a">Nothing to report this time.</p>') +
    (more > 0 ? '<p style="font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#55556a">And ' + more + ' more — the full report is in the app.</p>' : '') +
    '<p style="margin-top:20px"><a href="' + esc(o.appUrl) + '" style="font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;color:#6b5fc7">Open it in SquadRise</a></p>' +
    '<p style="font:11px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#8a8a9c;margin-top:16px">Sent to ' + esc(o.to) + ' because the ministry’s delivery schedule includes you. A leader can change it in the console.</p>' +
    '</div></body></html>';
  const text = [
    o.ministry,
    o.report + ' — ' + o.copy + ' — ' + o.when,
    '',
    result.columns.map((c) => c.label).join(' | '),
    ...rows.map((r) => result.columns.map((c) => String(r[c.id] ?? '')).join(' | ')),
    more > 0 ? '…and ' + more + ' more in the app.' : '',
    '',
    'Open it in SquadRise: ' + o.appUrl
  ].join('\n');
  return { subject, html, text };
}
