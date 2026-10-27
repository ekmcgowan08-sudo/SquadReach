/* The email a ministry's leaders get when someone asks to join — and the
   same words the console shows under "See the email notification", so the
   preview is what was sent. Every value is escaped. */
import { esc } from '@/lib/email/render';

export interface AccessNotice {
  ministry: string;
  name: string;
  /** The role they asked for, as people read it ("Coach"). */
  role: string;
  email: string;
  note: string;
  /** Where a leader decides: the console's People tab. */
  appUrl: string;
  to: string;
}

export function renderAccessNotice(o: AccessNotice) {
  const subject = 'Access request: ' + o.name + ' (' + o.role + ') at ' + o.ministry;
  const lines = [
    o.name + (o.email ? ' (' + o.email + ')' : '') + ' asked to join ' + o.ministry + ' as ' + o.role + '.',
    o.note ? 'Their note: “' + o.note + '”' : 'They left no note.',
    'Nobody gets in, and nobody sees a student’s name, until a leader approves them — as the role they asked for, or the one that fits what they actually do.'
  ];
  const p = 'font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#24242f;margin:0 0 12px';
  const html =
    '<!doctype html><html><body style="margin:0;background:#f6f6f9;padding:24px">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4ea;border-radius:10px;padding:24px">' +
    '<div style="font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b5fc7">' + esc(o.ministry) + '</div>' +
    '<h1 style="margin:8px 0 14px;font:500 20px/1.25 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c26">' + esc(o.name) + ' asked to join as ' + esc(o.role) + '</h1>' +
    lines.map((l) => '<p style="' + p + '">' + esc(l) + '</p>').join('') +
    '<p style="margin-top:18px"><a href="' + esc(o.appUrl) + '" style="font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;color:#6b5fc7">Decide in SquadRise</a></p>' +
    '<p style="font:11px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#8a8a9c;margin-top:16px">Sent to ' + esc(o.to) + ' because you lead this ministry in SquadRise.</p>' +
    '</div></body></html>';
  const text = [...lines, 'Decide in SquadRise: ' + o.appUrl].join('\n\n');
  return { subject, html, text };
}
