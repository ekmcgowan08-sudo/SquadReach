'use client';
/* CONSOLE · NOTIFICATIONS — which notifications are on for everyone in the
   ministry to begin with. Each person can still switch their own on or
   off in the phone's notification settings; their choice wins. */
import Link from 'next/link';
import { Section, useSaveConfig } from '@/components/console/kit';
import { cx } from '@/components/ui';
import { NOTIF_TRIGGERS } from '@/lib/prefs';
import { useApp } from '@/lib/store/provider';

export function NotifsTab() {
  const defaults = useApp((s) => s.data.config.notifDefaults) ?? {};
  const save = useSaveConfig();
  const on = (k: string) => defaults[k] !== false;
  const count = NOTIF_TRIGGERS.filter((t) => on(t.key)).length;

  return (
    <Section
      title="Notifications"
      sub="What’s on for everyone in the ministry to begin with. Each person can still change their own in the phone’s notification settings, and their choice wins. Who gets each one still follows their role: only leaders hear about role requests."
      right={<span className="whitespace-nowrap rounded-full border border-neutral-800 px-3 py-[6px] text-[12px] text-neutral-300">{count + ' of ' + NOTIF_TRIGGERS.length + ' on'}</span>}
    >
      <div className="grid gap-2 lg:grid-cols-2">
        {NOTIF_TRIGGERS.map((t) => (
          <label key={t.key} className={cx('flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2', on(t.key) ? 'border-accent-700' : 'border-neutral-800')}>
            <input type="checkbox" checked={on(t.key)} onChange={(e) => save((c) => ({ notifDefaults: { ...c.notifDefaults, [t.key]: e.target.checked } }), (e.target.checked ? 'Turned on ' : 'Turned off ') + t.label.toLowerCase() + ' for everyone')} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-neutral-100">{t.label}</span>
              <span className="block text-[12px] text-neutral-400">{t.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-[12px] leading-[1.5] text-neutral-500">
        Scheduled reports go out by email on their own schedule; set those up in{' '}
        <Link href="/console?tab=reports" className="text-accent-300 underline underline-offset-2">
          Reports
        </Link>
        . A phone shows these once its owner allows notifications.
      </p>
    </Section>
  );
}
