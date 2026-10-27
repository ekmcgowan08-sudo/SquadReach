import 'server-only';
/* When someone asks to join, every leader and owner with an email on file
   hears about it. Best effort: the request stands whether or not the mail
   goes, and with no email service or service role set up nothing is sent. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderAccessNotice } from '@/lib/email/access';
import { emailConfigured, sendEmail } from '@/lib/email/send';
import { serviceClient } from '@/lib/server/deliveries';
import { personaDef, type Persona } from '@/lib/types/domain';

interface Row {
  ministry: string;
  name: string;
  email: string;
  requested_role: Persona;
  note: string;
  to_email: string;
}

export interface NoticeDeps {
  db: SupabaseClient | null;
  mail: typeof sendEmail;
  configured: boolean;
}

export async function notifyLeaders(requestId: string, appUrl: string, deps: NoticeDeps = { db: serviceClient(), mail: sendEmail, configured: emailConfigured() }) {
  if (!deps.db || !deps.configured) return { sent: 0, skipped: 'not set up' as const };
  const found = await deps.db.rpc('access_notice_emails', { p_request: requestId });
  if (found.error) return { sent: 0, error: found.error.message };
  let sent = 0;
  const failed: string[] = [];
  for (const r of (found.data ?? []) as Row[]) {
    try {
      await deps.mail({ to: r.to_email, ...renderAccessNotice({ ministry: r.ministry, name: r.name, role: personaDef(r.requested_role).label, email: r.email, note: r.note, appUrl, to: r.to_email }) });
      sent++;
    } catch {
      failed.push(r.to_email);
    }
  }
  return { sent, failed };
}
